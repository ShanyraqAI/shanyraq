import { nightlyTotal, staysConflict } from "./date-range";
import { db } from "@/lib/db";
import {
  ACTIVE_RESERVATION_STATUSES,
  type ReservationStatus,
} from "@/lib/constants";
import {
  addDays,
  diffDays,
  formatISODate,
  parseISODate,
  toISODate,
  todayInTimeZone,
} from "@/lib/dates";
import {
  recomputeAvailability,
  remainingUnitsOnDate,
} from "@/lib/availability/service";
import { PublicError } from "@/server/errors";
import { getSessionUser } from "@/lib/auth/session";
import { enqueueHotelChannelSyncs } from "@/lib/channels/sync-outbox";
import type { Prisma } from "@prisma/client";

type ReservationDb = typeof db | Prisma.TransactionClient;
export interface ReservationMutationOptions {
  tx?: Prisma.TransactionClient;
  afterCommit?: (effect: () => Promise<void> | void) => void;
}
async function inReservationTransaction<T>(
  options: ReservationMutationOptions,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return options.tx
    ? work(options.tx)
    : db.$transaction(work, { timeout: 30_000 });
}

type ReservationPricingMode = "RATE_PLAN" | "MANUAL";

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
  const plan = await client.ratePlan.findFirst({
    where: { id: ratePlanId, hotelId, roomTypeId },
  });
  if (!plan)
    throw new PublicError(
      "Тариф не найден или не относится к выбранной категории номера",
    );
  const nights = diffDays(checkIn, checkOut);
  if (nights < 1)
    throw new PublicError("Дата выезда должна быть позже даты заезда");
  const dailyRates = await client.rate.findMany({
    where: { ratePlanId, date: { gte: checkIn, lt: addDays(checkIn, nights) } },
    select: { date: true, price: true },
  });
  return { total: nightlyTotal(Number(plan.basePrice), toISODate(checkIn), toISODate(checkOut), dailyRates.map((rate) => ({ date: toISODate(rate.date), price: Number(rate.price) }))), currency: plan.currency };
}

async function resolveStayPrice(
  hotelId: string,
  ratePlanId: string | null | undefined,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  pricingMode: ReservationPricingMode,
  manualTotalAmount: number | undefined,
  manualCurrency: string | undefined,
  client: ReservationDb,
): Promise<{ total: number; currency: string }> {
  if (pricingMode === "MANUAL") {
    if (
      manualTotalAmount === undefined ||
      !Number.isFinite(manualTotalAmount) ||
      manualTotalAmount < 0
    ) {
      throw new PublicError(
        "Укажите корректную итоговую стоимость бронирования",
      );
    }
    const currency = manualCurrency?.trim().toUpperCase();
    if (currency && !/^[A-Z]{3}$/.test(currency))
      throw new PublicError("Укажите корректную валюту бронирования");
    if (currency) return { total: manualTotalAmount, currency };
    const hotel = await client.hotel.findUnique({
      where: { id: hotelId },
      select: { currency: true },
    });
    if (!hotel) throw new PublicError("Отель не найден");
    return { total: manualTotalAmount, currency: hotel.currency };
  }
  if (!ratePlanId)
    throw new PublicError("Выберите тариф для расчёта стоимости");
  return computeStayTotal(
    hotelId,
    ratePlanId,
    roomTypeId,
    checkIn,
    checkOut,
    client,
  );
}

async function assertNoRoomOverlap(
  hotelId: string,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
  client: ReservationDb = db,
  times: { checkInTime?: string; checkOutTime?: string } = {},
): Promise<void> {
  // Include adjacent dates: a departure night is free, but a late departure
  // must not overlap an earlier arrival. The room lock is held by every writer.
  const stays = await client.reservation.findMany({
    where: { hotelId, roomId, status: { in: [...ACTIVE_RESERVATION_STATUSES] }, checkIn: { lte: checkOut }, checkOut: { gte: checkIn }, ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}) },
    select: { checkIn: true, checkOut: true, checkInTime: true, checkOutTime: true },
  });
  const range = { checkIn: toISODate(checkIn), checkOut: toISODate(checkOut), checkInTime: times.checkInTime ?? "14:00", checkOutTime: times.checkOutTime ?? "12:00" };
  if (stays.some((stay) => staysConflict(range, { ...stay, checkIn: toISODate(stay.checkIn), checkOut: toISODate(stay.checkOut) }))) throw new OverbookingError("В этой квартире уже есть бронь на выбранные даты или время. Измените даты либо выберите другую квартиру.");
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
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
    },
    select: { checkIn: true, checkOut: true },
  });
  const totalRooms = await client.room.count({
    where: {
      hotelId,
      roomTypeId,
      status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] },
    },
  });
  for (let i = 0; i < nights; i++) {
    const night = addDays(checkIn, i);
    const reserved = reservations.filter(
      (r) => r.checkIn <= night && r.checkOut > night,
    ).length;
    if (reserved >= totalRooms) {
      throw new OverbookingError(
        `Свободные номера категории «${await roomTypeName(roomTypeId, client)}» на ${formatISODate(toISODate(night))} закончились.`,
      );
    }
  }
}

async function roomTypeName(
  roomTypeId: string,
  client: ReservationDb = db,
): Promise<string> {
  const rt = await client.roomType.findUnique({
    where: { id: roomTypeId },
    select: { name: true },
  });
  return rt?.name ?? "номеров";
}

export class OverbookingError extends PublicError {
  constructor(message: string) {
    super(message);
    this.name = "OverbookingError";
  }
}

export async function lockBusinessKeys(
  tx: Prisma.TransactionClient,
  keys: string[],
): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}

export interface CreateReservationParams {
  hotelId: string;
  guestId: string;
  roomId: string;
  ratePlanId?: string | null;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  adults: number;
  children: number;
  pricingMode?: ReservationPricingMode;
  manualTotalAmount?: number;
  manualCurrency?: string;
  sourceChannel: string;
  externalReservationId?: string | null;
  status?: ReservationStatus;
  notes?: string | null;
  paymentMethod?: "ONLINE" | "CASH" | null;
  depositAmount?: number;
  depositCollected?: boolean;
  expectedRateTotal?: number;
  expectedRateCurrency?: string;
  /** Channel-originated imports must not recursively trigger another pull. */
  enqueueChannelSync?: boolean;
}

export async function createReservation(
  params: CreateReservationParams,
  options: ReservationMutationOptions = {},
) {
  const checkIn = parseISODate(params.checkIn);
  const checkOut = parseISODate(params.checkOut);
  if (checkOut <= checkIn)
    throw new PublicError("Дата выезда должна быть позже даты заезда");

  const result = await inReservationTransaction(options, async (tx) => {
    await lockBusinessKeys(tx, [`room:${params.roomId}`]);
    const [room, guest] = await Promise.all([
      tx.room.findFirst({
        where: {
          id: params.roomId,
          hotelId: params.hotelId,
          status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] },
        },
      }),
      tx.guest.findFirst({
        where: { id: params.guestId, hotelId: params.hotelId },
        select: { id: true, fullName: true },
      }),
    ]);
    if (!room) throw new PublicError("Номер не найден или временно недоступен");
    if (!guest) throw new PublicError("Гость не найден в текущем отеле");
    await lockBusinessKeys(tx, [`room-type:${room.roomTypeId}`]);
    await assertNoRoomOverlap(
      params.hotelId,
      room.id,
      checkIn,
      checkOut,
      undefined,
      tx,
      params,
    );
    await assertTypeAvailability(
      params.hotelId,
      room.roomTypeId,
      checkIn,
      checkOut,
      undefined,
      tx,
    );
    const pricingMode = params.pricingMode ?? "RATE_PLAN";
    const price = await resolveStayPrice(
      params.hotelId,
      params.ratePlanId,
      room.roomTypeId,
      checkIn,
      checkOut,
      pricingMode,
      params.manualTotalAmount,
      params.manualCurrency,
      tx,
    );
    if (pricingMode === "RATE_PLAN" && params.expectedRateTotal !== undefined && (Math.round(price.total * 100) !== Math.round(params.expectedRateTotal * 100) || price.currency !== params.expectedRateCurrency)) {
      throw new PublicError("Цена изменилась. Проверьте новую сумму и подтвердите бронь повторно. Введённые данные сохранены.");
    }
    const reservation = await tx.reservation.create({
      data: {
        hotelId: params.hotelId,
        rentalPropertyId: room.rentalPropertyId,
        guestId: params.guestId,
        roomId: room.id,
        roomTypeId: room.roomTypeId,
        ratePlanId: pricingMode === "MANUAL" ? null : params.ratePlanId,
        sourceChannel: params.sourceChannel,
        externalReservationId: params.externalReservationId ?? null,
        checkIn,
        checkOut,
        checkInTime: params.checkInTime ?? "14:00",
        checkOutTime: params.checkOutTime ?? "12:00",
        adults: params.adults,
        children: params.children,
        status: params.status ?? "CONFIRMED",
        pricingMode,
        currency: price.currency,
        totalAmount: price.total,
        notes: params.notes ?? null,
        paymentMethod: params.paymentMethod ?? null,
        depositAmount: params.depositAmount ?? 0,
        depositCollectedAt:
          params.depositCollected && (params.depositAmount ?? 0) > 0
            ? new Date()
            : null,
      },
    });
    await recomputeAvailability(
      params.hotelId,
      room.roomTypeId,
      checkIn,
      checkOut,
      tx,
    );
    if (params.enqueueChannelSync !== false)
      await enqueueHotelChannelSyncs(tx, params.hotelId);
    await writeAudit(
      params.hotelId,
      "reservation.created",
      "Reservation",
      reservation.id,
      {
        channel: params.sourceChannel,
        externalId: params.externalReservationId ?? undefined,
        reference: reservationReference(
          reservation.sequenceNumber,
          reservation.id,
        ),
      },
      undefined,
      {
        guest: guest.fullName,
        room: room.number,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        checkInTime: params.checkInTime ?? "14:00",
        checkOutTime: params.checkOutTime ?? "12:00",
        totalAmount: Number(reservation.totalAmount),
        currency: reservation.currency,
        status: reservation.status,
      },
      tx,
    );
    return { reservation, roomTypeId: room.roomTypeId, room, guest };
  });

  const notify = () =>
    notifyNewReservation(params.hotelId, {
      id: result.reservation.id,
      reference: reservationReference(
        result.reservation.sequenceNumber,
        result.reservation.id,
      ),
      guestName: result.guest.fullName,
      roomNumber: result.room.number,
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      sourceChannel: params.sourceChannel,
      totalAmount: Number(result.reservation.totalAmount),
      currency: result.reservation.currency,
    }).catch(() => {
      console.error("New reservation notification failed", {
        hotelId: params.hotelId,
        reservationId: result.reservation.id,
      });
    });
  if (options.tx) options.afterCommit?.(notify);
  else await notify();
  return result.reservation;
}

export interface UpdateReservationParams {
  id: string;
  hotelId: string;
  guestId: string;
  roomId: string;
  ratePlanId?: string | null;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  adults: number;
  children: number;
  pricingMode?: ReservationPricingMode;
  manualTotalAmount?: number;
  manualCurrency?: string;
  notes?: string | null;
  paymentMethod?: "ONLINE" | "CASH" | null;
  depositAmount?: number;
  depositCollected?: boolean;
  enqueueChannelSync?: boolean;
}

export async function updateReservationDetails(
  params: UpdateReservationParams,
  options: ReservationMutationOptions = {},
) {
  const checkIn = parseISODate(params.checkIn);
  const checkOut = parseISODate(params.checkOut);
  if (checkOut <= checkIn)
    throw new PublicError("Дата выезда должна быть позже даты заезда");
  const result = await inReservationTransaction(options, async (tx) => {
    await lockBusinessKeys(tx, [`reservation:${params.id}`]);
    const existing = await tx.reservation.findFirst({
      where: { id: params.id, hotelId: params.hotelId },
      include: {
        room: { select: { number: true } },
        guest: { select: { fullName: true } },
      },
    });
    if (!existing) throw new PublicError("Бронирование не найдено");
    if (
      !ACTIVE_RESERVATION_STATUSES.includes(
        existing.status as ReservationStatus,
      )
    )
      throw new PublicError(
        "Завершённую или отменённую бронь нельзя переносить.",
      );
    await lockBusinessKeys(tx, [
      `room:${existing.roomId}`,
      `room:${params.roomId}`,
    ]);
    const [room, guest] = await Promise.all([
      tx.room.findFirst({
        where: {
          id: params.roomId,
          hotelId: params.hotelId,
          status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] },
        },
      }),
      tx.guest.findFirst({
        where: { id: params.guestId, hotelId: params.hotelId },
        select: { id: true, fullName: true },
      }),
    ]);
    if (!room) throw new PublicError("Номер не найден или временно недоступен");
    if (!guest) throw new PublicError("Гость не найден в текущем отеле");
    const pricingMode = params.pricingMode ?? "RATE_PLAN";
    const price = await resolveStayPrice(
      params.hotelId,
      params.ratePlanId,
      room.roomTypeId,
      checkIn,
      checkOut,
      pricingMode,
      params.manualTotalAmount,
      params.manualCurrency,
      tx,
    );
    await lockBusinessKeys(tx, [
      `room-type:${existing.roomTypeId}`,
      `room-type:${room.roomTypeId}`,
    ]);
    await assertNoRoomOverlap(
      params.hotelId,
      room.id,
      checkIn,
      checkOut,
      existing.id,
      tx,
      params,
    );
    await assertTypeAvailability(
      params.hotelId,
      room.roomTypeId,
      checkIn,
      checkOut,
      existing.id,
      tx,
    );
    const updated = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        guestId: params.guestId,
        roomId: room.id,
        roomTypeId: room.roomTypeId,
        rentalPropertyId: room.rentalPropertyId,
        ratePlanId: pricingMode === "MANUAL" ? null : params.ratePlanId,
        checkIn,
        checkOut,
        checkInTime: params.checkInTime ?? "14:00",
        checkOutTime: params.checkOutTime ?? "12:00",
        adults: params.adults,
        children: params.children,
        pricingMode,
        currency: price.currency,
        totalAmount: price.total,
        notes: params.notes ?? null,
        paymentMethod:
          params.paymentMethod === undefined
            ? existing.paymentMethod
            : params.paymentMethod,
        ...(params.depositAmount !== undefined
          ? { depositAmount: params.depositAmount }
          : {}),
        ...(params.depositCollected !== undefined
          ? {
              depositCollectedAt:
                params.depositCollected &&
                (params.depositAmount ?? Number(existing.depositAmount)) > 0
                  ? (existing.depositCollectedAt ?? new Date())
                  : null,
            }
          : {}),
      },
    });
    await recomputeAvailability(
      params.hotelId,
      existing.roomTypeId,
      existing.checkIn,
      existing.checkOut,
      tx,
    );
    if (
      existing.roomTypeId !== room.roomTypeId ||
      existing.checkIn.getTime() !== checkIn.getTime() ||
      existing.checkOut.getTime() !== checkOut.getTime()
    ) {
      await recomputeAvailability(
        params.hotelId,
        room.roomTypeId,
        checkIn,
        checkOut,
        tx,
      );
    }
    if (params.enqueueChannelSync !== false)
      await enqueueHotelChannelSyncs(tx, params.hotelId);
    await writeAudit(
      params.hotelId,
      "reservation.updated",
      "Reservation",
      updated.id,
      {
        reference: reservationReference(updated.sequenceNumber, updated.id),
      },
      {
        guest: existing.guest.fullName,
        room: existing.room.number,
        checkIn: existing.checkIn.toISOString().slice(0, 10),
        checkOut: existing.checkOut.toISOString().slice(0, 10),
        totalAmount: Number(existing.totalAmount),
      },
      {
        guest: guest.fullName,
        room: room.number,
        checkIn: updated.checkIn.toISOString().slice(0, 10),
        checkOut: updated.checkOut.toISOString().slice(0, 10),
        checkInTime: updated.checkInTime,
        checkOutTime: updated.checkOutTime,
        totalAmount: Number(updated.totalAmount),
      },
      tx,
    );
    return { existing, room, guest, updated };
  });
  const { updated } = result;
  return updated;
}

const ROOM_STATUS_BY_RESERVATION_STATUS: Partial<
  Record<ReservationStatus, string>
> = {
  CHECKED_IN: "OCCUPIED",
  CHECKED_OUT: "CLEANING",
};

const ALLOWED_STATUS_TRANSITIONS: Record<
  ReservationStatus,
  readonly ReservationStatus[]
> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export async function setReservationStatus(
  hotelId: string,
  reservationId: string,
  status: ReservationStatus,
  options: ReservationMutationOptions & { enqueueChannelSync?: boolean } = {},
) {
  const { reservation, updated, changed } = await inReservationTransaction(
    options,
    async (tx) => {
      await lockBusinessKeys(tx, [`reservation:${reservationId}`]);
      const current = await tx.reservation.findFirst({
        where: { id: reservationId, hotelId },
      });
      if (!current) throw new PublicError("Бронирование не найдено");
      await lockBusinessKeys(tx, [`room:${current.roomId}`]);
      await lockBusinessKeys(tx, [`room-type:${current.roomTypeId}`]);
      const currentStatus = current.status as ReservationStatus;
      if (
        currentStatus !== status &&
        !ALLOWED_STATUS_TRANSITIONS[currentStatus]?.includes(status)
      ) {
        throw new PublicError("Недопустимый переход статуса бронирования");
      }
      if (currentStatus === status)
        return { reservation: current, updated: current, changed: false };

      if (ACTIVE_RESERVATION_STATUSES.includes(status)) {
        await assertNoRoomOverlap(
          hotelId,
          current.roomId,
          current.checkIn,
          current.checkOut,
          current.id,
          tx,
          current,
        );
      }
      const next = await tx.reservation.update({
        where: { id: current.id },
        data: { status },
      });
      const nextRoomStatus = ROOM_STATUS_BY_RESERVATION_STATUS[status];
      if (nextRoomStatus) {
        await tx.room.update({
          where: { id: current.roomId },
          data: { status: nextRoomStatus },
        });
      } else if (status === "CANCELLED" || status === "NO_SHOW") {
        const hotel = await tx.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { timezone: true } });
        const businessDate = todayInTimeZone(hotel.timezone);
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
          // Cancelling a booking must never clear maintenance/out-of-order/cleaning.
          await tx.room.updateMany({
            where: { id: current.roomId, hotelId, status: "OCCUPIED" },
            data: { status: "AVAILABLE" },
          });
        }
      }
      const wasActive = ACTIVE_RESERVATION_STATUSES.includes(currentStatus);
      const isActive = ACTIVE_RESERVATION_STATUSES.includes(status);
      if (wasActive !== isActive) {
        await recomputeAvailability(
          hotelId,
          current.roomTypeId,
          current.checkIn,
          current.checkOut,
          tx,
        );
      }
      if (options.enqueueChannelSync !== false)
        await enqueueHotelChannelSyncs(tx, hotelId);
      await writeAudit(
        hotelId,
        `reservation.${status.toLowerCase()}`,
        "Reservation",
        current.id,
        {
          reference: reservationReference(current.sequenceNumber, current.id),
        },
        { status: current.status },
        { status },
        tx,
      );
      return { reservation: current, updated: next, changed: true };
    },
  );
  if (!changed) return updated;
  const notify = async () => {
    if (status === "CHECKED_OUT") {
      const room = await db.room.findFirst({
        where: { id: reservation.roomId, hotelId },
        select: { number: true },
      });
      if (room) {
        const { createHotelNotification } =
          await import("@/lib/notifications/service");
        await createHotelNotification({
          hotelId,
          type: "URGENT_TASK",
          title: `Требуется уборка: номер ${room.number}`,
          body: "Гость выехал. Подготовьте квартиру к следующему заезду.",
          href: "/dashboard/rooms",
          dedupeKey: `cleaning-required:${reservation.id}`,
        }).catch(() => {
          console.error("Checkout cleaning notification failed", {
            hotelId,
            reservationId: reservation.id,
          });
        });
      }
    }
  };
  if (options.tx) options.afterCommit?.(notify);
  else
    await notify().catch(() => console.error("Checkout notification failed"));
  return updated;
}

/** Find a free physical room of a type for the given stay, or null. */
export async function findFreeRoom(
  hotelId: string,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  client: ReservationDb = db,
): Promise<{ id: string; number: string } | null> {
  const rooms = await client.room.findMany({
    where: {
      hotelId,
      roomTypeId,
      status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] },
    },
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });
  const busy = await client.reservation.findMany({
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
    const remaining = await remainingUnitsOnDate(
      hotelId,
      roomTypeId,
      addDays(checkIn, i),
    );
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
  client: ReservationDb = db,
): Promise<void> {
  // Reuse the transaction connection: a global session query can deadlock a saturated pool.
  const session = await getSessionUser(client).catch(() => null);
  const actorUserId = session?.hotelId === hotelId ? session.id : null;
  await client.auditLog.create({
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

function reservationReference(
  sequenceNumber: number | null,
  fallbackId: string,
): string {
  void fallbackId;
  return `B${sequenceNumber == null ? "—" : String(sequenceNumber).padStart(3, "0")}`;
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
  const { createHotelNotification, sendImmediateReservationEmails } =
    await import("@/lib/notifications/service");
  await createHotelNotification({
    hotelId,
    type: "NEW_RESERVATION",
    title: `Новая бронь ${reservation.reference}`,
    body: `${reservation.guestName} · номер ${reservation.roomNumber} · ${formatISODate(reservation.checkIn)}–${formatISODate(reservation.checkOut)}`,
    href: `/dashboard/reservations?reservation=${reservation.id}`,
    dedupeKey: `new-reservation:${reservation.id}`,
  });
  await sendImmediateReservationEmails(hotelId, reservation).catch(() => {
    console.error("New reservation email notification failed", {
      hotelId,
      reservationId: reservation.id,
    });
  });
}
