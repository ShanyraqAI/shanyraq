import { db } from "@/lib/db";
import { ACTIVE_RESERVATION_STATUSES, type ChannelCode, type ReservationStatus } from "@/lib/constants";
import { calculatePerformance } from "@/lib/reports/performance";
import { addDays, startOfMonth } from "./dates";

/**
 * Dashboard statistics service.
 * All numbers are computed from live reservation/availability data — nothing
 * on the dashboard is hardcoded.
 */

export interface ReservationWithRelations {
  id: string;
  sequenceNumber: number | null;
  status: string;
  checkIn: Date;
  checkOut: Date;
  checkInTime: string;
  checkOutTime: string;
  adults: number;
  children: number;
  ratePlanId: string | null;
  pricingMode: string;
  totalAmount: number | { toString(): string };
  currency: string;
  sourceChannel: string;
  notes: string | null;
  paymentMethod?: string | null;
  depositAmount?: number | { toString(): string };
  depositCollectedAt?: Date | null;
  depositReturnedAt?: Date | null;
  externalReservationId: string | null;
  createdAt: Date;
  guest: { id: string; fullName: string; email: string | null; phone: string | null; country: string | null };
  room: { id: string; number: string; floor: number; roomTypeId: string };
  roomType: { id: string; name: string };
}

export interface DashboardStats {
  date: Date;
  totalRooms: number;
  occupiedTonight: number;
  occupancyTonight: number; // 0..1
  availableRoomsTonight: number;
  activeReservations: number;
  activeReservationsByStatus: Record<Extract<ReservationStatus, "PENDING" | "CONFIRMED" | "CHECKED_IN">, number>;
  inHouseGuests: number;
  arrivalsToday: ReservationWithRelations[];
  departuresToday: ReservationWithRelations[];
  /** Revenue earned for the nights from the 1st through today, prorated per night like the Reports page. */
  revenueMonthToDate: number;
  revenueNightsMonthToDate: number;
  revenueByDay: Array<{ date: Date; value: number }>;
  revenueByChannel: Record<string, number>;
  occupancyTrend: DashboardDayPoint[];
  bookingTrend: DashboardDayPoint[];
  occupancyForecast: DashboardDayPoint[];
  roomsCleaning: number;
  roomsUnavailable: number;
}

export interface DashboardDayPoint {
  date: Date;
  value: number;
  count: number;
  total: number;
}

export async function getDashboardStats(hotelId: string, date: Date, timeZone = "UTC", currency?: string): Promise<DashboardStats> {
  const monthStart = startOfMonth(date);
  const nextDay = addDays(date, 1);
  const trendStart = addDays(date, -13);
  const forecastEnd = addDays(date, 7);

  const [totalRooms, tonightReservations, arrivals, departures, monthReservations, activeReservations, trendReservations, recentBookings, roomsCleaning, roomsUnavailable] = await Promise.all([
    db.room.count({ where: { hotelId, status: { not: "OUT_OF_ORDER" } } }),
    // Reservations whose stay covers "tonight" (date → date+1).
    db.reservation.findMany({
      where: {
        hotelId,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        checkIn: { lt: nextDay },
        checkOut: { gt: date },
      },
      include: RESERVATION_INCLUDE,
    }),
    db.reservation.findMany({
      where: { hotelId, checkIn: date },
      include: RESERVATION_INCLUDE,
      orderBy: { createdAt: "asc" },
    }),
    db.reservation.findMany({
      where: { hotelId, checkOut: date },
      include: RESERVATION_INCLUDE,
      orderBy: { createdAt: "asc" },
    }),
    db.reservation.findMany({
      where: {
        hotelId,
        checkIn: { lt: nextDay },
        checkOut: { gt: monthStart },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        ...(currency ? { currency } : {}),
      },
      select: { totalAmount: true, sourceChannel: true, checkIn: true, checkOut: true, status: true },
    }),
    db.reservation.findMany({
      where: { hotelId, status: { in: [...ACTIVE_RESERVATION_STATUSES] } },
      select: { status: true },
    }),
    db.reservation.findMany({
      where: {
        hotelId,
        status: { in: [...ACTIVE_RESERVATION_STATUSES] },
        checkIn: { lt: forecastEnd },
        checkOut: { gt: trendStart },
      },
      select: { checkIn: true, checkOut: true },
    }),
    db.reservation.findMany({
      where: { hotelId, createdAt: { gte: addDays(trendStart, -1), lt: addDays(nextDay, 1) } },
      select: { createdAt: true },
    }),
    db.room.count({ where: { hotelId, status: "CLEANING" } }),
    db.room.count({ where: { hotelId, status: { in: ["MAINTENANCE", "OUT_OF_ORDER"] } } }),
  ]);

  const occupiedTonight = tonightReservations.length;
  // Same prorated-per-night method as the Reports page so both screens agree.
  const monthPerformance = calculatePerformance(
    monthReservations.map((r) => ({ ...r, totalAmount: Number(r.totalAmount) })),
    totalRooms,
    { from: monthStart, to: date, source: null },
  );
  const revenueMonthToDate = monthPerformance.summary.revenue;
  const revenueByDay = [...monthPerformance.daily].reverse().map((day) => ({ date: day.date, value: day.revenue }));
  const revenueByChannel = Object.fromEntries(monthPerformance.revenueBySource.map((row) => [row.source, row.value]));
  const activeReservationsByStatus = {
    PENDING: 0,
    CONFIRMED: 0,
    CHECKED_IN: 0,
  } satisfies DashboardStats["activeReservationsByStatus"];
  for (const reservation of activeReservations) {
    if (reservation.status in activeReservationsByStatus) {
      activeReservationsByStatus[reservation.status as keyof typeof activeReservationsByStatus] += 1;
    }
  }

  const occupancyPoint = (pointDate: Date): DashboardDayPoint => {
    const pointEnd = addDays(pointDate, 1);
    const occupied = trendReservations.filter((reservation) => reservation.checkIn < pointEnd && reservation.checkOut > pointDate).length;
    return {
      date: pointDate,
      value: totalRooms === 0 ? 0 : Math.min(1, occupied / totalRooms),
      count: occupied,
      total: totalRooms,
    };
  };

  const occupancyTrend = Array.from({ length: 14 }, (_, index) => occupancyPoint(addDays(trendStart, index)));
  const bookingTrend = Array.from({ length: 14 }, (_, index) => {
    const pointDate = addDays(trendStart, index);
    const pointKey = pointDate.toISOString().slice(0, 10);
    const count = recentBookings.filter((reservation) => dateKeyInTimeZone(reservation.createdAt, timeZone) === pointKey).length;
    return { date: pointDate, value: count, count, total: 0 };
  });
  const occupancyForecast = Array.from({ length: 7 }, (_, index) => occupancyPoint(addDays(date, index)));

  return {
    date,
    totalRooms,
    occupiedTonight,
    occupancyTonight: totalRooms === 0 ? 0 : Math.min(1, occupiedTonight / totalRooms),
    availableRoomsTonight: Math.max(0, totalRooms - occupiedTonight),
    activeReservations: activeReservations.length,
    activeReservationsByStatus,
    inHouseGuests: tonightReservations.reduce((sum, r) => sum + r.adults + r.children, 0),
    arrivalsToday: arrivals as ReservationWithRelations[],
    departuresToday: departures as ReservationWithRelations[],
    revenueMonthToDate,
    revenueNightsMonthToDate: monthPerformance.summary.occupiedRoomNights,
    revenueByDay,
    revenueByChannel,
    occupancyTrend,
    bookingTrend,
    occupancyForecast,
    roomsCleaning,
    roomsUnavailable,
  };
}

function dateKeyInTimeZone(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export const RESERVATION_INCLUDE = {
  guest: { select: { id: true, fullName: true, email: true, phone: true, country: true } },
  room: { select: { id: true, number: true, floor: true, roomTypeId: true } },
  roomType: { select: { id: true, name: true } },
} as const;

/** Recent reservations for lists/tables. */
export async function getRecentReservations(hotelId: string, limit = 10): Promise<ReservationWithRelations[]> {
  const rows = await db.reservation.findMany({
    where: { hotelId },
    include: RESERVATION_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows as ReservationWithRelations[];
}

export async function getAllReservations(hotelId: string): Promise<ReservationWithRelations[]> {
  const rows = await db.reservation.findMany({
    where: { hotelId },
    include: RESERVATION_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { sequenceNumber: "desc" }],
  });
  return rows as ReservationWithRelations[];
}

export interface ChannelHealthRow {
  channelId: ChannelCode;
  connectionId: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  mappedRooms: number;
  mappedRates: number;
}

export async function getChannelHealth(hotelId: string): Promise<ChannelHealthRow[]> {
  const channels = await db.channel.findMany({ orderBy: { id: "asc" } });
  const connections = await db.channelConnection.findMany({
    where: { hotelId },
    include: { _count: { select: { roomMappings: true, rateMappings: true } } },
  });
  return channels.map((ch) => {
    const conn = connections.find((c) => c.channelId === ch.id);
    return {
      channelId: ch.id as ChannelCode,
      connectionId: conn?.id ?? null,
      status: (conn?.status ?? "DISCONNECTED") as ChannelHealthRow["status"],
      lastSyncAt: conn?.lastSyncAt ?? null,
      lastSyncStatus: conn?.lastSyncStatus ?? null,
      lastError: conn?.lastError ?? null,
      mappedRooms: conn?._count.roomMappings ?? 0,
      mappedRates: conn?._count.rateMappings ?? 0,
    };
  });
}
