import { db } from "@/lib/db";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { addDays, diffDays } from "@/lib/dates";

/**
 * Availability service.
 *
 * The Availability table is the single source of truth pushed to channels:
 *   availableRooms = sellableRooms − active reservations covering the night
 * It is never negative — overbooking protection clamps at zero upstream by
 * refusing new demand when no room is left.
 */

/** Sellable rooms for a type excludes physically out-of-order units. */
export async function countSellableRooms(hotelId: string, roomTypeId: string): Promise<number> {
  return db.room.count({
    where: { hotelId, roomTypeId, status: { not: "OUT_OF_ORDER" } },
  });
}

/** Create default availability rows for a range if they don't exist yet. */
export async function ensureAvailabilityRows(
  hotelId: string,
  roomTypeId: string,
  from: Date,
  nights: number,
): Promise<void> {
  const totalRooms = await countSellableRooms(hotelId, roomTypeId);
  const ops = [];
  for (let i = 0; i < nights; i++) {
    const date = addDays(from, i);
    ops.push(
      db.availability.upsert({
        where: { hotelId_roomTypeId_date: { hotelId, roomTypeId, date } },
        create: { hotelId, roomTypeId, date, totalRooms, availableRooms: totalRooms },
        update: {},
      }),
    );
  }
  await db.$transaction(ops);
}

/**
 * Recompute availability rows for the given room type over an inclusive date
 * range from in-memory reservation data (fine at MVP scale).
 */
export async function recomputeAvailability(
  hotelId: string,
  roomTypeId: string,
  from: Date,
  toExclusive: Date,
): Promise<number> {
  const nights = Math.max(1, diffDays(from, toExclusive));
  const [totalRooms, reservations] = await Promise.all([
    countSellableRooms(hotelId, roomTypeId),
    db.reservation.findMany({
      where: {
        hotelId,
        roomTypeId,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      },
      select: { checkIn: true, checkOut: true },
    }),
  ]);

  let updated = 0;
  for (let i = 0; i < nights; i++) {
    const date = addDays(from, i);
    const reserved = reservations.filter((r) => r.checkIn <= date && r.checkOut > date).length;
    const available = Math.max(0, totalRooms - reserved);
    const existing = await db.availability.findUnique({
      where: { hotelId_roomTypeId_date: { hotelId, roomTypeId, date } },
    });
    if (!existing) {
      await db.availability.create({
        data: { hotelId, roomTypeId, date, totalRooms, availableRooms: available },
      });
      updated++;
    } else if (existing.availableRooms !== available || existing.totalRooms !== totalRooms) {
      await db.availability.update({
        where: { id: existing.id },
        data: { totalRooms, availableRooms: available },
      });
      updated++;
    }
  }
  return updated;
}

/** Remaining bookable units for a room type on one specific night (0 = sold out). */
export async function remainingUnitsOnDate(
  hotelId: string,
  roomTypeId: string,
  date: Date,
): Promise<number> {
  const row = await db.availability.findUnique({
    where: { hotelId_roomTypeId_date: { hotelId, roomTypeId, date } },
  });
  if (row) return row.closed ? 0 : row.availableRooms;
  // No row yet → derive on the fly.
  const [totalRooms, reserved] = await Promise.all([
    countSellableRooms(hotelId, roomTypeId),
    db.reservation.count({
      where: {
        hotelId,
        roomTypeId,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        checkIn: { lte: date },
        checkOut: { gt: date },
      },
    }),
  ]);
  return Math.max(0, totalRooms - reserved);
}
