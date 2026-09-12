import "server-only";

import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { calculatePerformance, type ReportFilters } from "@/lib/reports/performance";

export async function getHotelPerformanceReport(hotelId: string, filters: ReportFilters) {
  const [hotel, roomCount, reservations, sourceRows] = await Promise.all([
    db.hotel.findUniqueOrThrow({ where: { id: hotelId }, select: { currency: true } }),
    db.room.count({ where: { hotelId, status: { not: "OUT_OF_ORDER" } } }),
    db.reservation.findMany({
      where: {
        hotelId,
        checkIn: { lt: addDays(filters.to, 1) },
        checkOut: { gt: filters.from },
      },
      select: { checkIn: true, checkOut: true, status: true, totalAmount: true, sourceChannel: true },
    }),
    db.reservation.findMany({
      where: { hotelId },
      distinct: ["sourceChannel"],
      orderBy: { sourceChannel: "asc" },
      select: { sourceChannel: true },
    }),
  ]);

  return {
    ...calculatePerformance(
      reservations.map((reservation) => ({ ...reservation, totalAmount: Number(reservation.totalAmount) })),
      roomCount,
      filters,
    ),
    sources: sourceRows.map((row) => row.sourceChannel),
    currency: hotel.currency,
  };
}
