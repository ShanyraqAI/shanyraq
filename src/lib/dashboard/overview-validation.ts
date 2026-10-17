import { z } from "zod";
import type { OverviewBlock, OverviewData } from "./overview-types";
const text = z.string().max(8000);
const number = z.number().finite();
const point = z.object({ date: z.string().datetime(), value: number, count: number, total: number });
const movement = z.object({ id: text, guest: z.object({ fullName: text }), room: z.object({ number: text }), roomType: z.object({ name: text }), sourceChannel: text, status: text, checkInTime: text, checkOutTime: text });
const attention = z.array(z.object({ priority: z.number().int().min(0).max(10).optional(), label: text, room: text, guest: text, href: z.string().startsWith("/dashboard/") })).max(200);
const schemas = {
  core: z.object({
    hotelName: text, currency: text, greeting: text, userFirstName: text, dateLabel: text, revenuePeriodLabel: text, attention,
    stats: z.object({
      totalRooms: number, occupiedTonight: number, occupancyTonight: number, availableRoomsTonight: number,
      activeReservations: number, activeReservationsByStatus: z.object({ PENDING: number, CONFIRMED: number, CHECKED_IN: number }),
      inHouseGuests: number, revenueMonthToDate: number, revenueNightsMonthToDate: number, revenueToday: number, roomsCleaning: number,
      arrivalsToday: z.array(movement).max(5000), departuresToday: z.array(movement).max(5000),
      occupancyTrend: z.array(point).max(31), bookingTrend: z.array(point).max(31), occupancyForecast: z.array(point).max(31),
    }),
  }),
  attention,
  recent: z.array(z.object({
    id: text, sequenceNumber: number.nullable(), guestName: text, roomNumber: text,
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    totalAmount: number, channel: text, status: text,
  }).strict()).max(20),
  channels: z.array(z.object({ channelId: text, connectionId: text.nullable(), status: z.enum(["CONNECTED", "DISCONNECTED", "ERROR"]), lastSyncAt: z.string().datetime().nullable(), lastSyncStatus: text.nullable(), lastError: text.nullable(), mappedRooms: number, mappedRates: number })).max(100),
};
export function validateOverviewBlock<K extends OverviewBlock>(block: K, data: unknown): data is OverviewData[K] {
  return schemas[block].safeParse(data).success;
}
