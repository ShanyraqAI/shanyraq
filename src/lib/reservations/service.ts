import { db } from "@/lib/db";
import { ACTIVE_RESERVATION_STATUSES, type ReservationStatus } from "@/lib/constants";
import { addDays, diffDays, parseISODate, today } from "@/lib/dates";
import { recomputeAvailability, remainingUnitsOnDate } from "@/lib/availability/service";
import { PublicError } from "@/server/errors";
import { getSessionUser } from "@/lib/auth/session";
import { enqueueHotelChannelSyncs } from "@/lib/channels/sync-outbox";
import type { Prisma } from "@prisma/client";

type ReservationDb = typeof db | Prisma.TransactionClient;

/**
 * Reservation service — all reservation mutations funnel through here so that
 * overbooking protection, availability recomputation and audit logging can
 * never be bypassed, regardless of the caller (UI action or channel import).
 */

export interface StayInput {
  roomId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
}

export async function computeStayTotal(
  hotelId: string,
  ratePlanId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  client: ReservationDb = db,
): Promise<{ total: number; currency: string }> {
  const plan = await client.ratePlan.findFirst({ where: { id: ratePlanId, hotelId, roomTypeId } });
  if (!plan) throw new PublicError("Тариф не найден или не относится к выбранной категории номера");
  const nights = diffDays(checkIn, checkOut);
  if (nights < 1) throw new PublicError("Дата выезда должна быть позже даты заезда");
  const dailyRates = await client.rate.findMany({
    where: { ratePlanId, date: { gte: checkIn, lt: addDays(checkIn, nights) } },
    select: { date: true, price: true },
  });
  if (dailyRates.length === 0) return { total: Number(plan.basePrice) * nights, currency: plan.currency };
  let total = 0;
  for (let i = 0; i < nights; i++) {
    const d = addDays(checkIn, i);
    const rate = dailyRates.find((r) => r.date.getTime() === d.getTime());
    total += Number(rate ? rate.price : plan.basePrice);
  }
  return { total, currency: plan.currency };
}

async function assertNoRoomOverlap(
  hotelId: string,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
  client: ReservationDb = db,
): Promise<void> {
  const clash = await client.reservation.findFirst({
    where: {
      hotelId,
      roomId,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw new OverbookingError("В этом номере уже есть бронь на выбранные даты.");
}

/**
 * Overbooking protection at room-type level: refuses demand when every unit of
 * the type is taken on any night of the stay. Inventory never goes negative.
 */
async function assertTypeAvailability(
  hotelId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
  client: ReservationDb = db,
): Promise<void> {
  const nights = Math.max(1, diffDays(checkIn, checkOut));
  const reservations = await client.reservation.findMany({
    where: {
      hotelId,
      roomTypeId,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: { checkIn: true, checkOut: true },
  });
  const totalRooms = await client.room.count({
    where: { hotelId, roomTypeId, status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] } },
  });
  for (let i = 0; i < nights; i++) {
    const night = addDays(checkIn, i);
    const reserved = reservations.filter((r) => r.checkIn <= night && r.checkOut > night).length;
    if (reserved >= totalRooms) {
      throw new OverbookingError(`Свободные номера категории «${await roomTypeName(roomTypeId, client)}» на ${night.toISOString().slice(0, 10)} закончились.`);
    }
  }
}

async function roomTypeName(roomTypeId: string, client: ReservationDb = db): Promise<string> {
  const rt = await client.roomType.findUnique({ where: { id: roomTypeId }, select: { name: true } });
  return rt?.name ?? "номеров";
}

export class OverbookingError extends PublicError {
  constructor(message: string) {
    super(message);
    this.name = "OverbookingError";
  }
}

async function lockBusinessKeys(tx: Prisma.TransactionClient, keys: string[]): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}

export interface CreateReservationParams {
  hotelId: string;
  guestId: string;
  roomId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  sourceChannel: string;
  externalReservationId?: string | null;
  status?: ReservationStatus;
  notes?: string | null;
}

export async function createReservation(params: CreateReservationParams) {
  const checkIn = parseISODate(params.checkIn);
  const checkOut = parseISODate(params.checkOut);
  if (checkOut <= checkIn) throw new PublicError("Дата выезда должна быть позже даты заезда");

  const result = await db.$transaction(async (tx) => {
    await lockBusinessKeys(tx, [`room:${params.roomId}`]);
    const [room, guest] = await Promise.all([
      tx.room.findFirst({ where: { id: params.roomId, hotelId: params.hotelId, status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] } } }),
      tx.guest.findFirst({ where: { id: params.guestId, hotelId: params.hotelId }, select: { id: true, fullName: true } }),
    ]);
    if (!room) throw new PublicError("Номер не найден или временно недоступен");
    if (!guest) throw new PublicError("Гость не найден в текущем отеле");
    await assertNoRoomOverlap(params.hotelId, room.id, checkIn, checkOut, undefined, tx);
    await assertTypeAvailability(params.hotelId, room.roomTypeId, checkIn, checkOut, undefined, tx);
    const price = await computeStayTotal(params.hotelId, params.ratePlanId, room.roomTypeId, checkIn, checkOut, tx);
    const reservation = await tx.reservation.create({
      data: {
        hotelId: params.hotelId, guestId: params.guestId, roomId: room.id, roomTypeId: room.roomTypeId,
        ratePlanId: params.ratePlanId, sourceChannel: params.sourceChannel,
        externalReservationId: params.externalReservationId ?? null, checkIn, checkOut,
        adults: params.adults, children: params.children, status: params.status ?? "CONFIRMED",
        currency: price.currency, totalAmount: price.total, notes: params.notes ?? null,
      },
    });
    await recomputeAvailability(params.hotelId, room.roomTypeId, checkIn, checkOut, tx);
    await enqueueHotelChannelSyncs(tx, params.hotelId);
    return { reservation, roomTypeId: room.roomTypeId, room, guest };
  }, { timeout: 15_000 });

  await writeAudit(params.hotelId, "reservation.created", "Reservation", result.reservation.id, {
    channel: params.sourceChannel,
    externalId: params.externalReservationId ?? undefined,
    reference: reservationReference(result.reservation.id, params.externalReservationId),
  }, undefined, {
    guest: result.guest.fullName,
    room: result.room.number,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    totalAmount: Number(result.reservation.totalAmount),
    currency: result.reservation.currency,
    status: result.reservation.status,
  });
  await notifyNewReservation(params.hotelId, {
    id: result.reservation.id,
    reference: reservationReference(result.reservation.id, params.externalReservationId),
    guestName: result.guest.fullName,
    roomNumber: result.room.number,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    sourceChannel: params.sourceChannel,
    totalAmount: Number(result.reservation.totalAmount),
    currency: result.reservation.currency,
  }).catch((error) => {
    console.error("New reservation notification failed", { hotelId: params.hotelId, reservationId: result.reservation.id, error });
  });
  return result.reservation;
}

export interface UpdateReservationParams {
  id: string;
  hotelId: string;
  guestId: string;
  roomId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  notes?: string | null;
}

export async function updateReservationDetails(params: UpdateReservationParams) {
  const checkIn = parseISODate(params.checkIn);
  const checkOut = parseISODate(params.checkOut);
  if (checkOut <= checkIn) throw new PublicError("Дата выезда должна быть позже даты заезда");
  const result = await db.$transaction(async (tx) => {
    await lockBusinessKeys(tx, [`reservation:${params.id}`]);
    const existing = await tx.reservation.findFirst({
      where: { id: params.id, hotelId: params.hotelId },
      include: { room: { select: { number: true } }, guest: { select: { fullName: true } } },
    });
    if (!existing) throw new PublicError("Бронирование не найдено");
    if (!ACTIVE_RESERVATION_STATUSES.includes(existing.status as ReservationStatus)) throw new PublicError("Завершённую или отменённую бронь нельзя переносить.");
    await lockBusinessKeys(tx, [`room:${existing.roomId}`, `room:${params.roomId}`]);
    const [room, guest] = await Promise.all([
      tx.room.findFirst({ where: { id: params.roomId, hotelId: params.hotelId, status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] } } }),
      tx.guest.findFirst({ where: { id: params.guestId, hotelId: params.hotelId }, select: { id: true, fullName: true } }),
    ]);
    if (!room) throw new PublicError("Номер не найден или временно недоступен");
    if (!guest) throw new PublicError("Гость не найден в текущем отеле");
    const price = await computeStayTotal(params.hotelId, params.ratePlanId, room.roomTypeId, checkIn, checkOut, tx);
    await assertNoRoomOverlap(params.hotelId, room.id, checkIn, checkOut, existing.id, tx);
    await assertTypeAvailability(params.hotelId, room.roomTypeId, checkIn, checkOut, existing.id, tx);
    const updated = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        guestId: params.guestId, roomId: room.id, roomTypeId: room.roomTypeId, ratePlanId: params.ratePlanId,
        checkIn, checkOut, adults: params.adults, children: params.children,
        currency: price.currency, totalAmount: price.total, notes: params.notes ?? null,
      },
    });
    await recomputeAvailability(params.hotelId, existing.roomTypeId, existing.checkIn, existing.checkOut, tx);
    if (
      existing.roomTypeId !== room.roomTypeId ||
      existing.checkIn.getTime() !== checkIn.getTime() ||
      existing.checkOut.getTime() !== checkOut.getTime()
    ) {
      await recomputeAvailability(params.hotelId, room.roomTypeId, checkIn, checkOut, tx);
    }
    await enqueueHotelChannelSyncs(tx, params.hotelId);
    return { existing, room, guest, updated };
  }, { timeout: 15_000 });
  const { updated } = result;
  await writeAudit(params.hotelId, "reservation.updated", "Reservation", updated.id, {
    reference: reservationReference(updated.id, updated.externalReservationId),
  }, {
    guest: result.existing.guest.fullName,
    room: result.existing.room.number,
    checkIn: result.existing.checkIn.toISOString().slice(0, 10),
    checkOut: result.existing.checkOut.toISOString().slice(0, 10),
    totalAmount: Number(result.existing.totalAmount),
  }, {
    guest: result.guest.fullName,
    room: result.room.number,
    checkIn: updated.checkIn.toISOString().slice(0, 10),
    checkOut: updated.checkOut.toISOString().slice(0, 10),
    totalAmount: Number(updated.totalAmount),
  });
  return updated;
}

const ROOM_STATUS_BY_RESERVATION_STATUS: Partial<Record<ReservationStatus, string>> = {
  CHECKED_IN: "OCCUPIED",
  CHECKED_OUT: "CLEANING",
};

const ALLOWED_STATUS_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export async function setReservationStatus(hotelId: string, reservationId: string, status: ReservationStatus) {
  const { reservation, updated, changed } = await db.$transaction(async (tx) => {
    await lockBusinessKeys(tx, [`reservation:${reservationId}`]);
    const current = await tx.reservation.findFirst({ where: { id: reservationId, hotelId } });
    if (!current) throw new PublicError("Бронирование не найдено");
    await lockBusinessKeys(tx, [`room:${current.roomId}`]);
    const currentStatus = current.status as ReservationStatus;
    if (currentStatus !== status && !ALLOWED_STATUS_TRANSITIONS[currentStatus]?.includes(status)) {
      throw new PublicError("Недопустимый переход статуса бронирования");
    }
    if (currentStatus === status) return { reservation: current, updated: current, changed: false };

    if (ACTIVE_RESERVATION_STATUSES.includes(status)) {
      await assertNoRoomOverlap(hotelId, current.roomId, current.checkIn, current.checkOut, current.id, tx);
    }
    const next = await tx.reservation.update({ where: { id: current.id }, data: { status } });
    const nextRoomStatus = ROOM_STATUS_BY_RESERVATION_STATUS[status];
    if (nextRoomStatus) {
      await tx.room.update({ where: { id: current.roomId }, data: { status: nextRoomStatus } });
    } else if (status === "CANCELLED" || status === "NO_SHOW") {
      const businessDate = today();
      const stillOccupied = await tx.reservation.count({
        where: {
          hotelId,
          roomId: current.roomId,
          id: { not: current.id },
          status: { in: [...ACTIVE_RESERVATION_STATUSES] },
          checkIn: { lte: businessDate },
          checkOut: { gt: businessDate },
        },
      });
      if (stillOccupied === 0) {
        await tx.room.update({ where: { id: current.roomId }, data: { status: "AVAILABLE" } });
      }
    }
    const wasActive = ACTIVE_RESERVATION_STATUSES.includes(currentStatus);
    const isActive = ACTIVE_RESERVATION_STATUSES.includes(status);
    if (wasActive !== isActive) {
      await recomputeAvailability(hotelId, current.roomTypeId, current.checkIn, current.checkOut, tx);
    }
    await enqueueHotelChannelSyncs(tx, hotelId);
    return { reservation: current, updated: next, changed: true };
  }, { timeout: 15_000 });
  if (!changed) return updated;
  await writeAudit(hotelId, `reservation.${status.toLowerCase()}`, "Reservation", reservation.id, {
    reference: reservationReference(reservation.id, reservation.externalReservationId),
  }, { status: reservation.status }, { status });
  return updated;
}

/** Find a free physical room of a type for the given stay, or null. */
export async function findFreeRoom(
  hotelId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<{ id: string; number: string } | null> {
  const rooms = await db.room.findMany({
    where: { hotelId, roomTypeId, status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] } },
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });
  const busy = await db.reservation.findMany({
    where: {
      hotelId,
      roomTypeId,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
    },
    select: { roomId: true },
  });
  const busyIds = new Set(busy.map((b) => b.roomId));
  return rooms.find((r) => !busyIds.has(r.id)) ?? null;
}

/** Guard used by the sync engine before importing external demand. */
export async function hasAvailabilityForStay(
  hotelId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<boolean> {
  const nights = Math.max(1, diffDays(checkIn, checkOut));
  for (let i = 0; i < nights; i++) {
    const remaining = await remainingUnitsOnDate(hotelId, roomTypeId, addDays(checkIn, i));
    if (remaining <= 0) return false;
  }
  return true;
}

export async function writeAudit(
  hotelId: string,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>,
  oldValue?: Record<string, unknown>,
  newValue?: Record<string, unknown>,
): Promise<void> {
  const session = await getSessionUser().catch(() => null);
  const actorUserId = session?.hotelId === hotelId ? session.id : null;
  await db.auditLog.create({
    data: {
      hotelId,
      actor: actorUserId ? "user" : "system",
      actorUserId,
      action,
      entity,
      entityId: entityId ?? null,
      metaJson: meta ? JSON.stringify(meta) : null,
      oldValueJson: oldValue ? JSON.stringify(oldValue) : null,
      newValueJson: newValue ? JSON.stringify(newValue) : null,
    },
  });
}

function reservationReference(id: string, externalId?: string | null): string {
  return externalId || id.slice(-6).toUpperCase();
}

async function notifyNewReservation(
  hotelId: string,
  reservation: {
    id: string;
    reference: string;
    guestName: string;
    roomNumber: string;
    checkIn: string;
    checkOut: string;
    sourceChannel: string;
    totalAmount: number;
    currency: string;
  },
): Promise<void> {
  const { createHotelNotification, sendImmediateReservationEmails } = await import("@/lib/notifications/service");
  await createHotelNotification({
    hotelId,
    type: "NEW_RESERVATION",
    title: `Новая бронь №${reservation.reference}`,
    body: `${reservation.guestName} · номер ${reservation.roomNumber} · ${reservation.checkIn}–${reservation.checkOut}`,
    href: `/dashboard/reservations?reservation=${reservation.id}`,
    dedupeKey: `new-reservation:${reservation.id}`,
  });
  await sendImmediateReservationEmails(hotelId, reservation).catch((error) => {
    console.error("New reservation email notification failed", { hotelId, reservationId: reservation.id, error });
  });
}
