import { db } from "@/lib/db";
import { getChannelProvider } from "./provider-registry";
import type { ChannelConnectionContext, ExternalReservation } from "./types";
import type { AvailabilityUpdate, RateUpdate } from "./types";
import { parseISODate, addDays, toISODate } from "@/lib/dates";
import {
  createReservation,
  findFreeRoom,
  hasAvailabilityForStay,
  writeAudit,
} from "@/lib/reservations/service";
import { t, pluralize } from "@/lib/i18n";
import { decryptChannelCredentials } from "@/lib/security/credentials";
import { PublicError } from "@/server/errors";
import {
  getSyncIncidentId,
  syncBusyMessage,
  syncFailureMessage,
} from "./sync-errors";
import { channelSyncEnabled } from "./runtime-policy";

/**
 * Synchronization engine.
 *
 * Flow per channel connection:
 *   verify → pull reservations → normalize → guard overbooking → store →
 *   push rates → push availability → record SyncLog + update connection state.
 *
 * MVP runs synchronously inside a request. The function signature is
 * job-shaped (single connectionId in, SyncLog out) so a real queue/worker can
 * wrap it later without touching callers.
 */

export interface SyncSummary {
  logId: string;
  channelId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  reservationsImported: number;
  ratesUpdated: number;
  availabilityUpdated: number;
  message: string | null;
  incidentId: string | null;
}

const SYNC_HORIZON_DAYS = 30;

export async function runChannelSync(
  connectionId: string,
  hotelId: string,
): Promise<SyncSummary> {
  if (!channelSyncEnabled())
    throw new PublicError("Синхронизация каналов временно отключена.");
  // Atomic claim shared by single sync, bulk sync and deletion across servers.
  const { connection, log } = await db.$transaction(async (tx) => {
    const claimed = await tx.channelConnection.updateMany({
      where: {
        id: connectionId,
        hotelId,
        status: { in: ["CONNECTED", "ERROR"] },
        channel: { isInternal: false },
        OR: [{ lastSyncStatus: null }, { lastSyncStatus: { not: "RUNNING" } }],
      },
      data: { lastSyncStatus: "RUNNING" },
    });
    if (claimed.count !== 1) {
      const existing = await tx.channelConnection.findFirst({
        where: { id: connectionId, hotelId },
        select: { lastSyncStatus: true },
      });
      throw new PublicError(
        existing?.lastSyncStatus === "RUNNING"
          ? syncBusyMessage
          : "Подключение недоступно для синхронизации.",
      );
    }
    const connection = await tx.channelConnection.findUniqueOrThrow({
      where: { id: connectionId, hotelId },
      include: {
        channel: true,
        roomMappings: true,
        rateMappings: { include: { ratePlan: true } },
      },
    });
    const log = await tx.syncLog.create({
      data: {
        connectionId,
        channelId: connection.channelId,
        status: "RUNNING",
      },
    });
    return { connection, log };
  });

  let reservationsImported = 0;
  let skipped = 0;
  let ratesUpdated = 0;
  let availabilityUpdated = 0;
  const notes: string[] = [];

  try {
    if (connection.status !== "CONNECTED" && connection.status !== "ERROR") {
      throw new Error("Канал не подключён.");
    }
    const provider = getChannelProvider(connection.channelId);
    const context = buildContext(connection);

    // 1. Verify connection is alive.
    if (!connection.credentialsEncrypted)
      throw new Error(
        "Подключение нужно настроить заново: защищённые учётные данные отсутствуют.",
      );
    const credentials = decryptChannelCredentials(
      connection.credentialsEncrypted,
    );
    const verification = await provider.verifyCredentials(credentials);
    if (!verification.ok)
      throw new Error(
        `Проверка подключения не пройдена: ${verification.error}`,
      );

    // 2-4. Pull, normalize and store reservations (with overbooking guards).
    const pull = await provider.pullReservations(context);
    for (const external of pull.reservations) {
      const outcome = await importExternalReservation(
        hotelId,
        connection,
        external,
      );
      if (outcome === "imported") reservationsImported++;
      else if (outcome === "skipped") skipped++;
      else if (outcome === "blocked") {
        skipped++;
        notes.push(
          `${external.guestName}: нет свободных номеров — бронь заблокирована защитой от овербукинга`,
        );
      }
    }

    // Advance the incremental cursor by everything we consumed from the feed.
    await db.channelConnection.update({
      where: { id: connection.id },
      data: { importCursor: context.importCursor + pull.reservations.length },
    });

    // 5-7. Push internal truth back to the channel.
    if (connection.roomMappings.length > 0) {
      availabilityUpdated = await pushAvailabilityToChannel(
        hotelId,
        connection,
        provider,
        context,
      );
    }
    if (connection.rateMappings.length > 0) {
      ratesUpdated = await pushRatesToChannel(
        hotelId,
        connection,
        provider,
        context,
      );
    }

    // 8. Record outcome.
    const parts = [
      reservationsImported === 0
        ? "Новых броней нет"
        : `Импортировано ${reservationsImported} ${pluralize(reservationsImported, "бронирование", "бронирования", "бронирований")}`,
      `отправлено цен: ${ratesUpdated}`,
      `отправлено записей доступности: ${availabilityUpdated}`,
    ];
    let message = parts.join(" · ");
    if (skipped > 0) message += ` · пропущено: ${skipped}`;
    if (notes.length > 0) message += ` — ${notes[0]}`;

    const status: SyncSummary["status"] = skipped > 0 ? "PARTIAL" : "SUCCESS";
    return await finishLog(log.id, connection, status, {
      reservationsImported,
      ratesUpdated,
      availabilityUpdated,
      message,
    });
  } catch {
    const incidentId = crypto.randomUUID();
    // Provider exceptions can contain credentials, URLs and response bodies.
    console.error("Channel sync failed", {
      incidentId,
      connectionId: connection.id,
      logId: log.id,
    });
    const errorMessage = syncFailureMessage(incidentId);
    return finishLog(log.id, connection, "FAILED", {
      reservationsImported,
      ratesUpdated,
      availabilityUpdated,
      message: null,
      error: errorMessage,
    });
  }
}

export async function syncAllConnectedChannels(
  hotelId: string,
): Promise<SyncSummary[]> {
  const connections = await db.channelConnection.findMany({
    where: {
      hotelId,
      status: { in: ["CONNECTED", "ERROR"] },
      channel: { isInternal: false },
    },
    select: { id: true, channelId: true },
  });
  const summaries: SyncSummary[] = [];
  for (const c of connections) {
    try {
      summaries.push(await runChannelSync(c.id, hotelId));
    } catch (error) {
      if (!(error instanceof PublicError)) throw error;
      summaries.push({
        logId: "",
        channelId: c.channelId,
        status: "FAILED",
        incidentId: null,
        reservationsImported: 0,
        ratesUpdated: 0,
        availabilityUpdated: 0,
        message: error.message,
      });
    }
  }
  return summaries;
}

// ---------------------------------------------------------------------------

type ImportOutcome = "imported" | "skipped" | "blocked";

async function importExternalReservation(
  hotelId: string,
  connection: import("@prisma/client").Prisma.ChannelConnectionGetPayload<{
    include: { channel: true; roomMappings: true };
  }>,
  external: ExternalReservation,
): Promise<ImportOutcome> {
  // Already imported? (idempotent replays)
  const existing = await db.reservation.findFirst({
    where: {
      hotelId,
      sourceChannel: connection.channelId,
      externalReservationId: external.externalId,
    },
    select: { id: true, status: true },
  });

  if (existing) {
    if (external.status === "CANCELLED" && existing.status !== "CANCELLED") {
      const { setReservationStatus } =
        await import("@/lib/reservations/service");
      await setReservationStatus(hotelId, existing.id, "CANCELLED");
      return "imported"; // cancellation counts as an applied change
    }
    return "skipped";
  }

  if (external.status === "CANCELLED") return "skipped"; // nothing local to cancel

  const mapping = connection.roomMappings.find(
    (m) => m.externalRoomTypeId === external.externalRoomTypeId,
  );
  if (!mapping) return "skipped"; // unmapped room types are never silently guessed

  const checkIn = parseISODate(external.checkIn);
  const checkOut = parseISODate(external.checkOut);

  // Overbooking protection: refuse demand when inventory is exhausted.
  if (
    !(await hasAvailabilityForStay(
      hotelId,
      mapping.roomTypeId,
      checkIn,
      checkOut,
    ))
  ) {
    return "blocked";
  }

  const room = await findFreeRoom(
    hotelId,
    mapping.roomTypeId,
    checkIn,
    checkOut,
  );
  if (!room) return "blocked";

  // Contact details and names are not proof of identity. A new external booking
  // gets its own guest profile; modifications above retain the linked booking.
  const guest = await db.guest.create({
    data: {
      hotelId,
      fullName: external.guestName,
      email: external.guestEmail ?? null,
      phone: external.guestPhone ?? null,
      country: external.guestCountry ?? null,
    },
    select: { id: true },
  });

  await createReservation({
    hotelId,
    guestId: guest.id,
    roomId: room.id,
    ratePlanId: await guessRatePlanId(
      hotelId,
      connection.id,
      mapping.roomTypeId,
    ),
    checkIn: external.checkIn,
    checkOut: external.checkOut,
    adults: external.adults,
    children: external.children,
    sourceChannel: connection.channelId,
    externalReservationId: external.externalId,
    status: "CONFIRMED",
    notes: external.notes ?? null,
    enqueueChannelSync: false,
  });
  return "imported";
}

async function guessRatePlanId(
  hotelId: string,
  connectionId: string,
  roomTypeId: string,
): Promise<string> {
  const mapped = await db.channelRateMapping.findFirst({
    where: { connectionId, ratePlan: { hotelId, roomTypeId } },
    select: { ratePlanId: true },
  });
  if (mapped) return mapped.ratePlanId;
  const plan = await db.ratePlan.findFirst({
    where: { hotelId, roomTypeId },
    select: { id: true },
  });
  if (!plan) throw new Error(t.reservations.errors.noPlanForType);
  return plan.id;
}

async function pushAvailabilityToChannel(
  hotelId: string,
  connection: {
    id: string;
    roomMappings: { externalRoomTypeId: string; roomTypeId: string }[];
  },
  provider: ReturnType<typeof getChannelProvider>,
  context: ChannelConnectionContext,
): Promise<number> {
  const from = startOfTodayUtc();
  const updates: AvailabilityUpdate[] = [];
  for (const mapping of connection.roomMappings) {
    const rows = await db.availability.findMany({
      where: {
        hotelId,
        roomTypeId: mapping.roomTypeId,
        date: { gte: from, lt: addDays(from, SYNC_HORIZON_DAYS) },
      },
      orderBy: { date: "asc" },
    });
    for (const row of rows) {
      updates.push({
        externalRoomTypeId: mapping.externalRoomTypeId,
        date: toISODate(row.date),
        availableRooms: row.availableRooms,
        closed: row.closed || row.availableRooms <= 0,
        minStay: row.minStay,
      });
    }
  }
  if (updates.length === 0) return 0;
  const result = await provider.pushAvailability(context, updates);
  await writeAudit(
    hotelId,
    "channel.availability_pushed",
    "ChannelConnection",
    connection.id,
    {
      count: result.accepted,
    },
  );
  return result.accepted;
}

async function pushRatesToChannel(
  hotelId: string,
  connection: {
    id: string;
    rateMappings: { externalRateId: string; ratePlanId: string }[];
  },
  provider: ReturnType<typeof getChannelProvider>,
  context: ChannelConnectionContext,
): Promise<number> {
  const from = startOfTodayUtc();
  const currency = (
    await db.hotel.findUniqueOrThrow({
      where: { id: hotelId },
      select: { currency: true },
    })
  ).currency;
  const updates: RateUpdate[] = [];
  for (const mapping of connection.rateMappings) {
    const rates = await db.rate.findMany({
      where: {
        ratePlanId: mapping.ratePlanId,
        date: { gte: from, lt: addDays(from, SYNC_HORIZON_DAYS) },
      },
      orderBy: { date: "asc" },
    });
    for (const r of rates) {
      updates.push({
        externalRateId: mapping.externalRateId,
        date: toISODate(r.date),
        price: Number(r.price),
        currency,
      });
    }
  }
  if (updates.length === 0) return 0;
  const result = await provider.pushRates(context, updates);
  await writeAudit(
    hotelId,
    "channel.rates_pushed",
    "ChannelConnection",
    connection.id,
    {
      count: result.accepted,
    },
  );
  return result.accepted;
}

async function finishLog(
  logId: string,
  connection: { id: string; channelId: string },
  status: SyncSummary["status"],
  counters: {
    reservationsImported: number;
    ratesUpdated: number;
    availabilityUpdated: number;
    message: string | null;
    error?: string;
  },
): Promise<SyncSummary> {
  const finishedAt = new Date();
  await db.$transaction([
    db.syncLog.update({
      where: { id: logId },
      data: {
        finishedAt,
        status,
        reservationsImported: counters.reservationsImported,
        ratesUpdated: counters.ratesUpdated,
        availabilityUpdated: counters.availabilityUpdated,
        message: counters.message,
        error: counters.error ?? null,
      },
    }),
    db.channelConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: finishedAt,
        lastSyncStatus: status,
        lastError: counters.error ?? null,
        status: status === "FAILED" ? "ERROR" : "CONNECTED",
      },
    }),
  ]);
  return {
    logId,
    channelId: connection.channelId,
    status,
    ...counters,
    message: counters.error ?? counters.message,
    incidentId: getSyncIncidentId(counters.error),
  };
}

function buildContext(connection: {
  id: string;
  hotelId: string;
  channelId: string;
  externalPropertyId: string | null;
  credentialsJson: string | null;
  credentialsEncrypted: string | null;
  importCursor: number;
}): ChannelConnectionContext {
  return {
    connectionId: connection.id,
    channelId: connection.channelId as ChannelConnectionContext["channelId"],
    hotelId: connection.hotelId,
    externalPropertyId: connection.externalPropertyId,
    credentials: connection.credentialsEncrypted
      ? decryptChannelCredentials(connection.credentialsEncrypted)
      : null,
    importCursor: connection.importCursor,
  };
}

/**
 * Credential access is centralized here so the future encrypted secret store
 * only replaces this one function. Credentials are NEVER logged and NEVER
 * returned to the browser.
 */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
