import { db } from "@/lib/db";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { addDays, diffDays } from "@/lib/dates";
import type { Prisma } from "@prisma/client";

type AvailabilityDb = typeof db | Prisma.TransactionClient;

/**
 * Availability service.
 *
 * The Availability table is the single source of truth pushed to channels:
 *   availableRooms = sellableRooms − active reservations covering the night
 * It is never negative — overbooking protection clamps at zero upstream by
 * refusing new demand when no room is left.
 */

/** Sellable rooms for a type excludes physically out-of-order units. */
export async function countSellableRooms(
  hotelId: string,
  roomTypeId: string,
  client: AvailabilityDb = db,
): Promise<number> {
  return client.room.count({
    where: { hotelId, roomTypeId, status: { notIn: ["OUT_OF_ORDER", "MAINTENANCE"] } },
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
  client: AvailabilityDb = db,
): Promise<number> {
  const nights = Math.max(1, diffDays(from, toExclusive));
  const [totalRooms, reservations, existingRows] = await Promise.all([
    countSellableRooms(hotelId, roomTypeId, client),
    client.reservation.findMany({
      where: {
        hotelId,
        roomTypeId,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
      },
      select: { checkIn: true, checkOut: true },
    }),
    client.availability.findMany({
      where: { hotelId, roomTypeId, date: { gte: from, lt: toExclusive } },
      select: { id: true, date: true, totalRooms: true, availableRooms: true },
    }),
  ]);

  const existingByDate = new Map(existingRows.map((row) => [row.date.getTime(), row]));
  const operations: Promise<unknown>[] = [];
  for (let i = 0; i < nights; i++) {
    const date = addDays(from, i);
    const reserved = reservations.filter((r) => r.checkIn <= date && r.checkOut > date).length;
    const available = Math.max(0, totalRooms - reserved);
    const existing = existingByDate.get(date.getTime());
    if (!existing) {
      operations.push(client.availability.create({
        data: { hotelId, roomTypeId, date, totalRooms, availableRooms: available },
      }));
    } else if (existing.availableRooms !== available || existing.totalRooms !== totalRooms) {
      operations.push(client.availability.update({
        where: { id: existing.id },
        data: { totalRooms, availableRooms: available },
      }));
    }
  }
  await Promise.all(operations);
  return operations.length;
}

/** Recalculate every materialized day affected by a room-count change. */
export async function recomputeExistingAvailability(
  hotelId: string,
  roomTypeIds: string[],
  client: AvailabilityDb = db,
): Promise<number> {
  let updated = 0;
  for (const roomTypeId of [...new Set(roomTypeIds)]) {
    const range = await client.availability.aggregate({
      where: { hotelId, roomTypeId },
      _min: { date: true },
      _max: { date: true },
    });
    if (!range._min.date || !range._max.date) continue;
    updated += await recomputeAvailability(
      hotelId,
      roomTypeId,
      range._min.date,
      addDays(range._max.date, 1),
      client,
    );
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
