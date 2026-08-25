import type { ReservationVM, RoomVM, RatePlanVM, GuestVM } from "@/lib/types";

/** Everything the calendar board needs, fully serialized. */
export interface CalendarBoardData {
  rooms: RoomVM[];
  reservations: ReservationVM[];
  ratePlans: RatePlanVM[];
  guests: GuestVM[];
  hotelCurrency: string;
}

export type CalendarViewMode = "day" | "week" | "month";

export interface CalendarFilters {
  roomTypeId: string;
  channelId: string;
  statusId: string;
}
