import type { DashboardDayPoint, DashboardStats, ChannelHealthRow } from "@/lib/stats";
import type { ReservationVM } from "@/lib/types";
import type { HotelPermission } from "@/lib/access";

export const OVERVIEW_BLOCKS = ["core", "attention", "recent", "channels"] as const;
export type OverviewBlock = (typeof OVERVIEW_BLOCKS)[number];
export interface OverviewContext {
  scope: string;
  deviceScope: string;
  day: string;
  locale: "ru" | "kk";
  permissions: HotelPermission[];
}
export function overviewScope(userId: string, organizationId: string, hotelId: string, role: string, permissions: readonly string[]) {
  return JSON.stringify([userId, organizationId, hotelId, role, [...permissions].sort()]);
}
export function overviewParams(context: Pick<OverviewContext, "day" | "locale">) {
  return JSON.stringify([context.day, context.locale]);
}
export interface AttentionItem { priority?: number; label: string; room: string; guest: string; href: string }
export type WirePoint = Omit<DashboardDayPoint, "date"> & { date: string };
export interface TodayRow {
  id: string;
  guest: { fullName: string };
  room: { number: string };
  roomType: { name: string };
  sourceChannel: string;
  status: string;
  checkInTime: string;
  checkOutTime: string;
}
export interface OverviewCore {
  hotelName: string;
  currency: string;
  greeting: string;
  userFirstName: string;
  dateLabel: string;
  revenuePeriodLabel: string;
  stats: Pick<DashboardStats, "totalRooms" | "occupiedTonight" | "occupancyTonight" | "availableRoomsTonight" | "activeReservations" | "activeReservationsByStatus" | "inHouseGuests" | "revenueMonthToDate" | "revenueNightsMonthToDate" | "roomsCleaning"> & {
    revenueToday: number;
    arrivalsToday: TodayRow[];
    departuresToday: TodayRow[];
    occupancyTrend: WirePoint[];
    bookingTrend: WirePoint[];
    occupancyForecast: WirePoint[];
  };
  attention: AttentionItem[];
}
export type OverviewRecentRow = Pick<ReservationVM, "id" | "sequenceNumber" | "guestName" | "roomNumber" | "checkIn" | "checkOut" | "channel" | "totalAmount" | "status">;
export interface OverviewData {
  core: OverviewCore;
  attention: AttentionItem[];
  recent: OverviewRecentRow[];
  channels: Array<Omit<ChannelHealthRow, "lastSyncAt"> & { lastSyncAt: string | null }>;
}
