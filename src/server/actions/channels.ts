"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSessionHotelId } from "@/server/guards";
import {
  connectChannelSchema,
  saveRoomMappingsSchema,
  saveRateMappingsSchema,
  firstZodError,
  type ChannelCode,
} from "@/lib/constants";
import { getChannelProvider } from "@/lib/channels/provider-registry";
import type { ChannelCredentials, ExternalInventory } from "@/lib/channels/types";
import {
  enqueueAllChannelSyncs,
  enqueueChannelSync,
} from "@/lib/channels/sync-outbox";
import { wakeChannelSyncWorker } from "@/server/channel-sync";
import { writeAudit } from "@/lib/reservations/service";
import { ok, fail, type ActionResult } from "@/server/types";
import { PublicError } from "@/server/errors";
import { channelRequestFailed, syncBusyMessage } from "@/lib/channels/sync-errors";
import { t } from "@/lib/i18n";
import { encryptChannelCredentials } from "@/lib/security/credentials";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getSessionUser } from "@/lib/auth/session";
import { PRODUCT_AVAILABILITY } from "@/lib/product-availability";

function assertChannelsAvailable(): void {
  if (!PRODUCT_AVAILABILITY.channels) {
    throw new PublicError("Подключение каналов временно недоступно в закрытой бете.");
  }
}

function revalidateChannels() {
  revalidatePath("/dashboard/channels", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
}

/** Never log provider exceptions: they can embed credentials. */
function toErrorMessage(error: unknown): string {
  if (error instanceof PublicError) return error.message;
  const incidentId = crypto.randomUUID();
  console.error("Channel action failed", { incidentId });
  return `${channelRequestFailed} Код инцидента: ${incidentId}`;
}

/** Credentials are encrypted on the server and never returned to the client. */
function storeCredentials(credentials: ChannelCredentials): string {
  return encryptChannelCredentials(credentials);
}

export async function testChannelConnectionAction(input: unknown): Promise<ActionResult> {
  try {
    assertChannelsAvailable();
    const parsed = connectChannelSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    await enforceRateLimit("channel-test", `${hotelId}:${parsed.data.channelId}`, 10, 15 * 60_000);
    const provider = getChannelProvider(parsed.data.channelId);
    const result = await provider.verifyCredentials({
      propertyId: parsed.data.externalPropertyId,
      username: parsed.data.username,
      apiKey: parsed.data.apiKey,
    });
    if (result.ok) return ok(undefined, "Проверка подключения выполнена.");
    return fail("Не удалось проверить подключение. Проверьте введённые данные.");
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function connectChannelAction(input: unknown): Promise<ActionResult<{ connectionId: string }>> {
  try {
    assertChannelsAvailable();
    const parsed = connectChannelSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const data = parsed.data;

    const channel = await db.channel.findUnique({ where: { id: data.channelId } });
    if (!channel) return fail(t.channelsPage.errors.unknownChannel);

    const credentials: ChannelCredentials = {
      propertyId: data.externalPropertyId,
      username: data.username,
      apiKey: data.apiKey,
    };

    const connection = await db.channelConnection.upsert({
      where: { hotelId_channelId: { hotelId, channelId: data.channelId } },
      create: {
        hotelId,
        channelId: data.channelId,
        status: "CONNECTED",
        externalPropertyId: credentials.propertyId,
        credentialsEncrypted: storeCredentials(credentials),
        credentialsJson: null,
      },
      update: {
        status: "CONNECTED",
        externalPropertyId: credentials.propertyId,
        credentialsEncrypted: storeCredentials(credentials),
        credentialsJson: null,
        lastError: null,
      },
    });

    await writeAudit(hotelId, "channel.connected", "ChannelConnection", connection.id, {
      channel: data.channelId,
      propertyId: credentials.propertyId,
    });
    revalidateChannels();
    return ok({ connectionId: connection.id }, t.channelsPage.toasts.connected(channel.name));
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function disconnectChannelAction(connectionId: string): Promise<ActionResult> {
  try {
    assertChannelsAvailable();
    const hotelId = await requireSessionHotelId();
    if (typeof connectionId !== "string" || !connectionId || connectionId.length > 128) {
      return fail(t.channelsPage.errors.connectionNotFound);
    }
    const connection = await db.channelConnection.findFirst({
      where: { id: connectionId, hotelId, channel: { isInternal: false } },
      select: { channel: { select: { name: true } } },
    });
    if (!connection) return fail(t.channelsPage.errors.connectionNotFound);

    const session = await getSessionUser();
    const actorUserId = session?.hotelId === hotelId ? session.id : null;
    await db.$transaction(async (tx) => {
      // One conditional DELETE races safely with the sync claim. Related
      // credentials, mappings and logs cascade; reservations are independent.
      const removed = await tx.channelConnection.deleteMany({
        where: {
          id: connectionId, hotelId, channel: { isInternal: false },
          OR: [{ lastSyncStatus: null }, { lastSyncStatus: { not: "RUNNING" } }],
          syncJobs: { none: { status: { in: ["PENDING", "RUNNING"] } } },
        },
      });
      if (removed.count !== 1) throw new PublicError(syncBusyMessage);
      await tx.auditLog.create({
        data: {
          hotelId,
          actor: actorUserId ? "user" : "system",
          actorUserId,
          action: "channel.disconnected",
          entity: "ChannelConnection",
          entityId: connectionId,
        },
      });
    });
    revalidateChannels();
    return ok(undefined, t.channelsPage.toasts.disconnected(connection.channel.name));
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function saveRoomMappingsAction(input: unknown): Promise<ActionResult> {
  try {
    assertChannelsAvailable();
    const parsed = saveRoomMappingsSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const connection = await db.channelConnection.findFirst({
      where: { id: parsed.data.connectionId, hotelId },
    });
    if (!connection) return fail(t.channelsPage.errors.connectionNotFound);

    const requestedTypeIds = [...new Set(parsed.data.mappings.map((mapping) => mapping.roomTypeId))];
    const ownedTypes = await db.roomType.count({
      where: { hotelId, id: { in: requestedTypeIds } },
    });
    if (ownedTypes !== requestedTypeIds.length) return fail("Одна из категорий номера не принадлежит текущему отелю");

    // Replace-all keeps mapping state consistent with the UI.
    await db.$transaction([
      db.channelRoomMapping.deleteMany({ where: { connectionId: connection.id } }),
      ...parsed.data.mappings.map((m) =>
        db.channelRoomMapping.create({
          data: {
            connectionId: connection.id,
            roomTypeId: m.roomTypeId,
            externalRoomTypeId: m.externalRoomTypeId,
            externalRoomName: m.externalRoomName,
          },
        }),
      ),
    ]);
    await writeAudit(hotelId, "channel.room_mappings_saved", "ChannelConnection", connection.id, {
      count: parsed.data.mappings.length,
    });
    revalidateChannels();
    return ok(undefined, t.channelsPage.toasts.roomMappingsSaved);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function saveRateMappingsAction(input: unknown): Promise<ActionResult> {
  try {
    assertChannelsAvailable();
    const parsed = saveRateMappingsSchema.safeParse(input);
    if (!parsed.success) return fail(firstZodError(parsed.error));
    const hotelId = await requireSessionHotelId();
    const connection = await db.channelConnection.findFirst({
      where: { id: parsed.data.connectionId, hotelId },
    });
    if (!connection) return fail(t.channelsPage.errors.connectionNotFound);

    const requestedPlanIds = [...new Set(parsed.data.mappings.map((mapping) => mapping.ratePlanId))];
    const ownedPlans = await db.ratePlan.count({
      where: { hotelId, id: { in: requestedPlanIds } },
    });
    if (ownedPlans !== requestedPlanIds.length) return fail("Один из тарифов не принадлежит текущему отелю");

    await db.$transaction([
      db.channelRateMapping.deleteMany({ where: { connectionId: connection.id } }),
      ...parsed.data.mappings.map((m) =>
        db.channelRateMapping.create({
          data: {
            connectionId: connection.id,
            ratePlanId: m.ratePlanId,
            externalRateId: m.externalRateId,
            externalRateName: m.externalRateName,
          },
        }),
      ),
    ]);
    await writeAudit(hotelId, "channel.rate_mappings_saved", "ChannelConnection", connection.id, {
      count: parsed.data.mappings.length,
    });
    revalidateChannels();
    return ok(undefined, t.channelsPage.toasts.rateMappingsSaved);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

/**
 * Catalogue of the channel's rooms/rates shown in the mapping UI.
 * Safe to call before/without a saved connection (mock providers only need a code).
 */
export async function fetchExternalInventoryAction(channelCode: string): Promise<ActionResult<ExternalInventory>> {
  try {
    assertChannelsAvailable();
    const hotelId = await requireSessionHotelId();
    await enforceRateLimit("channel-inventory", `${hotelId}:${channelCode}`, 20, 15 * 60_000);
    const provider = getChannelProvider(channelCode);
    const inventory = await provider.fetchExternalInventory({
      connectionId: "",
      channelId: channelCode as ChannelCode,
      hotelId,
      externalPropertyId: null,
      credentials: null,
      importCursor: 0,
    });
    return ok(inventory);
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function syncChannelAction(connectionId: string): Promise<
  ActionResult<{
    status: string;
    reservationsImported: number;
    message: string | null;
    error: string | null;
    incidentId: string | null;
  }>
> {
  try {
    assertChannelsAvailable();
    const hotelId = await requireSessionHotelId({ allowExpiredSync: true });
    if (typeof connectionId !== "string" || !connectionId || connectionId.length > 128) {
      return fail(t.channelsPage.errors.connectionNotFound);
    }
    const owned = await db.channelConnection.findFirst({
      where: { id: connectionId, hotelId, channel: { isInternal: false } },
      select: { id: true },
    });
    if (!owned) return fail(t.channelsPage.errors.connectionNotFound);

    await enforceRateLimit("channel-sync", `${hotelId}:${connectionId}`, 10, 60_000);
    await enqueueChannelSync(connectionId, hotelId);
    wakeChannelSyncWorker();
    revalidateChannels();
    return ok(
      {
        status: "QUEUED",
        reservationsImported: 0,
        message: t.channelsPage.syncButtons.queued,
        error: null,
        incidentId: null,
      },
      t.channelsPage.syncButtons.queued,
    );
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}

export async function syncAllChannelsAction(): Promise<ActionResult<{ results: { channelId: string; status: string; error: string | null }[] }>> {
  try {
    assertChannelsAvailable();
    const hotelId = await requireSessionHotelId({ allowExpiredSync: true });
    await enforceRateLimit("channel-sync-all", hotelId, 5, 60_000);
    const jobs = await enqueueAllChannelSyncs(hotelId);
    if (jobs.length > 0) wakeChannelSyncWorker(jobs.length);
    revalidateChannels();
    return ok(
      {
        results: jobs.map((job) => ({
          channelId: job.channelId,
          status: "QUEUED",
          error: null,
        })),
      },
      jobs.length === 0
        ? t.channelsPage.syncButtons.nothingToSync
        : t.channelsPage.syncButtons.queuedSome(jobs.length),
    );
  } catch (error) {
    return fail(toErrorMessage(error));
  }
}
