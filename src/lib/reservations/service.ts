import { db } from "@/lib/db";
import { ACTIVE_RESERVATION_STATUSES, type ReservationStatus } from "@/lib/constants";
import { addDays, diffDays, parseISODate } from "@/lib/dates";
import { recomputeAvailability, remainingUnitsOnDate } from "@/lib/availability/service";

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
  ratePlanId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<number> {
  const plan = await db.ratePlan.findUniqueOrThrow({ where: { id: ratePlanId } });
  const nights = Math.max(1, diffDays(checkIn, checkOut));
  const dailyRates = await db.rate.findMany({
    where: { ratePlanId, date: { gte: checkIn, lt: addDays(checkIn, nights) } },
    select: { date: true, price: true },
  });
  if (dailyRates.length === 0) return plan.basePrice * nights;
  let total = 0;
  for (let i = 0; i < nights; i++) {
    const d = addDays(checkIn, i);
    const rate = dailyRates.find((r) => r.date.getTime() === d.getTime());
    total += rate ? rate.price : plan.basePrice;
  }
  return total;
}

async function assertNoRoomOverlap(
  hotelId: string,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
): Promise<void> {
  const clash = await db.reservation.findFirst({
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
  if (clash) throw new OverbookingError("This room already has a reservation for the selected dates.");
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
): Promise<void> {
  const nights = Math.max(1, diffDays(checkIn, checkOut));
  const reservations = await db.reservation.findMany({
    where: {
      hotelId,
      roomTypeId,
      status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: { checkIn: true, checkOut: true },
  });
  const totalRooms = await db.room.count({
    where: { hotelId, roomTypeId, status: { not: "OUT_OF_ORDER" } },
  });
  for (let i = 0; i < nights; i++) {
    const night = addDays(checkIn, i);
    const reserved = reservations.filter((r) => r.checkIn <= night && r.checkOut > night).length;
    if (reserved >= totalRooms) {
      throw new OverbookingError(`No ${await roomTypeName(roomTypeId)} left for ${night.toISOString().slice(0, 10)} — sold out.`);
    }
  }
}

async function roomTypeName(roomTypeId: string): Promise<string> {
  const rt = await db.roomType.findUnique({ where: { id: roomTypeId }, select: { name: true } });
  return rt?.name ?? "rooms";
}

export class OverbookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OverbookingError";
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

  const room = await db.room.findUnique({ where: { id: params.roomId } });
  if (!room || room.hotelId !== params.hotelId) throw new Error("Room not found");

  await assertNoRoomOverlap(params.hotelId, room.id, checkIn, checkOut);
  await assertTypeAvailability(params.hotelId, room.roomTypeId, checkIn, checkOut);

  const totalAmount = await computeStayTotal(params.ratePlanId, checkIn, checkOut);

  const reservation = await db.reservation.create({
    data: {
      hotelId: params.hotelId,
      guestId: params.guestId,
      roomId: room.id,
      roomTypeId: room.roomTypeId,
      sourceChannel: params.sourceChannel,
      externalReservationId: params.externalReservationId ?? null,
      checkIn,
      checkOut,
      adults: params.adults,
      children: params.children,
      status: params.status ?? "CONFIRMED",
      currency: "KZT",
      totalAmount,
      notes: params.notes ?? null,
    },
  });

  await recomputeAvailability(params.hotelId, room.roomTypeId, checkIn, checkOut);
  await writeAudit(params.hotelId, "reservation.created", "Reservation", reservation.id, {
    channel: params.sourceChannel,
    externalId: params.externalReservationId ?? undefined,
  });
  return reservation;
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
  const existing = await db.reservation.findFirst({
    where: { id: params.id, hotelId: params.hotelId },
  });
  if (!existing) throw new Error("Reservation not found");

  const checkIn = parseISODate(params.checkIn);
  const checkOut = parseISODate(params.checkOut);
  const room = await db.room.findUnique({ where: { id: params.roomId } });
  if (!room || room.hotelId !== params.hotelId) throw new Error("Room not found");

  // Price is always derived from the current rate calendar.
  const totalAmount = await computeStayTotal(params.ratePlanId, checkIn, checkOut);

  await assertNoRoomOverlap(params.hotelId, room.id, checkIn, checkOut, existing.id);
  await assertTypeAvailability(params.hotelId, room.roomTypeId, checkIn, checkOut, existing.id);

  const updated = await db.reservation.update({
    where: { id: existing.id },
    data: {
      guestId: params.guestId,
      roomId: room.id,
      roomTypeId: room.roomTypeId,
      checkIn,
      checkOut,
      adults: params.adults,
      children: params.children,
      totalAmount,
      notes: params.notes ?? null,
    },
  });

  // Availability may change on both old and new ranges.
  await recomputeAvailability(params.hotelId, existing.roomTypeId, existing.checkIn, existing.checkOut);
  if (
    existing.roomTypeId !== room.roomTypeId ||
    existing.checkIn.getTime() !== checkIn.getTime() ||
    existing.checkOut.getTime() !== checkOut.getTime()
  ) {
    await recomputeAvailability(params.hotelId, room.roomTypeId, checkIn, checkOut);
  }
  await writeAudit(params.hotelId, "reservation.updated", "Reservation", updated.id);
  return updated;
}

const ROOM_STATUS_BY_RESERVATION_STATUS: Partial<Record<ReservationStatus, string>> = {
  CHECKED_IN: "OCCUPIED",
  CHECKED_OUT: "CLEANING",
};

export async function setReservationStatus(hotelId: string, reservationId: string, status: ReservationStatus) {
  const reservation = await db.reservation.findFirst({
    where: { id: reservationId, hotelId },
  });
  if (!reservation) throw new Error("Reservation not found");

  const updated = await db.reservation.update({ where: { id: reservation.id }, data: { status } });

  const nextRoomStatus = ROOM_STATUS_BY_RESERVATION_STATUS[status];
  if (nextRoomStatus) {
    await db.room.update({ where: { id: reservation.roomId }, data: { status: nextRoomStatus } });
  } else if (status === "CANCELLED" || status === "NO_SHOW") {
    // Free the physical room only if no other active stay occupies it tonight.
    const stillOccupied = await db.reservation.count({
      where: {
        roomId: reservation.roomId,
        id: { not: reservation.id },
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        checkIn: { lte: new Date() },
        checkOut: { gt: new Date() },
      },
    });
    if (stillOccupied === 0) {
      await db.room.update({ where: { id: reservation.roomId }, data: { status: "AVAILABLE" } });
    }
  }

  // Cancelling/no-show frees inventory.
  if (status === "CANCELLED" || status === "NO_SHOW") {
    await recomputeAvailability(hotelId, reservation.roomTypeId, reservation.checkIn, reservation.checkOut);
  }
  await writeAudit(hotelId, `reservation.${status.toLowerCase()}`, "Reservation", reservation.id);
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
): Promise<void> {
  await db.auditLog.create({
    data: {
      hotelId,
      action,
      entity,
      entityId: entityId ?? null,
      metaJson: meta ? JSON.stringify(meta) : null,
    },
  });
}
