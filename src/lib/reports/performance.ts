import { addDays, diffDays, eachDay, isISODate, parseISODate, toISODate } from "@/lib/dates";

export const MAX_REPORT_DAYS = 367;

export type ReportReservation = {
  checkIn: Date;
  checkOut: Date;
  status: string;
  totalAmount: number;
  sourceChannel: string;
};

export type ReportFilters = {
  from: Date;
  to: Date;
  source: string | null;
};

export type DailyPerformance = {
  date: Date;
  occupiedRooms: number;
  availableRooms: number;
  occupancy: number;
  revenue: number;
  adr: number;
  revpar: number;
};

export function parseReportFilters(
  input: { from?: string | string[]; to?: string | string[]; source?: string | string[] },
  today: Date,
): ReportFilters {
  const defaultFrom = addDays(today, -29);
  const fromText = typeof input.from === "string" ? input.from : "";
  const toText = typeof input.to === "string" ? input.to : "";
  const parsedFrom = isISODate(fromText) ? parseISODate(fromText) : defaultFrom;
  const parsedTo = isISODate(toText) ? parseISODate(toText) : today;
  const validRange = parsedTo >= parsedFrom && diffDays(parsedFrom, parsedTo) < MAX_REPORT_DAYS;
  const sourceText = typeof input.source === "string" ? input.source.trim() : "";
  const source = sourceText && sourceText !== "all" && /^[a-zA-Z0-9_-]{1,50}$/.test(sourceText) ? sourceText : null;

  return {
    from: validRange ? parsedFrom : defaultFrom,
    to: validRange ? parsedTo : today,
    source,
  };
}

export function calculatePerformance(
  reservations: ReportReservation[],
  roomCount: number,
  filters: ReportFilters,
) {
  const toExclusive = addDays(filters.to, 1);
  const eligible = reservations.filter((reservation) =>
    !["CANCELLED", "NO_SHOW"].includes(reservation.status) &&
    (!filters.source || reservation.sourceChannel === filters.source) &&
    reservation.checkIn < toExclusive &&
    reservation.checkOut > filters.from,
  );

  const daily: DailyPerformance[] = eachDay(filters.from, toExclusive).map((date) => {
    const stays = eligible.filter((reservation) => reservation.checkIn <= date && reservation.checkOut > date);
    const occupiedRooms = stays.length;
    const revenue = stays.reduce((sum, reservation) => {
      const stayLength = Math.max(1, diffDays(reservation.checkIn, reservation.checkOut));
      return sum + reservation.totalAmount / stayLength;
    }, 0);
    return {
      date,
      occupiedRooms,
      availableRooms: roomCount,
      occupancy: roomCount > 0 ? Math.min(1, occupiedRooms / roomCount) : 0,
      revenue,
      adr: occupiedRooms > 0 ? revenue / occupiedRooms : 0,
      revpar: roomCount > 0 ? revenue / roomCount : 0,
    };
  });

  const occupiedRoomNights = daily.reduce((sum, day) => sum + day.occupiedRooms, 0);
  const availableRoomNights = roomCount * daily.length;
  const revenue = daily.reduce((sum, day) => sum + day.revenue, 0);
  const bySource = new Map<string, number>();
  for (const reservation of eligible) {
    const overlapStart = reservation.checkIn > filters.from ? reservation.checkIn : filters.from;
    const overlapEnd = reservation.checkOut < toExclusive ? reservation.checkOut : toExclusive;
    const overlapNights = Math.max(0, diffDays(overlapStart, overlapEnd));
    const stayLength = Math.max(1, diffDays(reservation.checkIn, reservation.checkOut));
    const allocatedRevenue = reservation.totalAmount * overlapNights / stayLength;
    bySource.set(reservation.sourceChannel, (bySource.get(reservation.sourceChannel) ?? 0) + allocatedRevenue);
  }

  return {
    daily: [...daily].reverse(),
    summary: {
      revenue,
      occupiedRoomNights,
      availableRoomNights,
      occupancy: availableRoomNights > 0 ? occupiedRoomNights / availableRoomNights : 0,
      adr: occupiedRoomNights > 0 ? revenue / occupiedRoomNights : 0,
      revpar: availableRoomNights > 0 ? revenue / availableRoomNights : 0,
    },
    revenueBySource: Array.from(bySource, ([source, value]) => ({ source, value })).sort((a, b) => b.value - a.value),
    period: { from: toISODate(filters.from), to: toISODate(filters.to), days: daily.length },
  };
}
