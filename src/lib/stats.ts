import { db } from "@/lib/db";
import { ACTIVE_RESERVATION_STATUSES, type ChannelCode } from "@/lib/constants";
import { addDays, startOfMonth } from "./dates";

/**
 * Dashboard statistics service.
 * All numbers are computed from live reservation/availability data — nothing
 * on the dashboard is hardcoded.
 */

export interface ReservationWithRelations {
  id: string;
  status: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  totalAmount: number;
  currency: string;
  sourceChannel: string;
  notes: string | null;
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
  inHouseGuests: number;
  arrivalsToday: ReservationWithRelations[];
  departuresToday: ReservationWithRelations[];
  revenueMonthToDate: number;
  revenueByChannel: Record<string, number>;
}

export async function getDashboardStats(hotelId: string, date: Date): Promise<DashboardStats> {
  const monthStart = startOfMonth(date);
  const nextDay = addDays(date, 1);

  const [totalRooms, tonightReservations, arrivals, departures, monthReservations] = await Promise.all([
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
        checkIn: { gte: monthStart, lt: nextDay },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { totalAmount: true, sourceChannel: true },
    }),
  ]);

  const occupiedTonight = tonightReservations.length;
  const revenueByChannel: Record<string, number> = {};
  let revenueMonthToDate = 0;
  for (const r of monthReservations) {
    revenueMonthToDate += r.totalAmount;
    revenueByChannel[r.sourceChannel] = (revenueByChannel[r.sourceChannel] ?? 0) + r.totalAmount;
  }

  const activeCount = await db.reservation.count({
    where: { hotelId, status: { in: [...ACTIVE_RESERVATION_STATUSES] } },
  });

  return {
    date,
    totalRooms,
    occupiedTonight,
    occupancyTonight: totalRooms === 0 ? 0 : Math.min(1, occupiedTonight / totalRooms),
    availableRoomsTonight: Math.max(0, totalRooms - occupiedTonight),
    activeReservations: activeCount,
    inHouseGuests: tonightReservations.reduce((sum, r) => sum + r.adults + r.children, 0),
    arrivalsToday: arrivals as ReservationWithRelations[],
    departuresToday: departures as ReservationWithRelations[],
    revenueMonthToDate,
    revenueByChannel,
  };
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
    orderBy: [{ checkIn: "asc" }, { createdAt: "desc" }],
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
