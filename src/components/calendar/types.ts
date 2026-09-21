import type { ReservationVM, RoomVM, RatePlanVM, GuestVM } from "@/lib/types";

/** Everything the calendar board needs, fully serialized. */
export interface CalendarBoardData {
  rooms: RoomVM[];
  canReorderRooms: boolean;
  reservations: ReservationVM[];
  ratePlans: RatePlanVM[];
  guests: GuestVM[];
  hotelCurrency: string;
  todayISO: string;
  initialPreferences: CalendarPreferences;
}

export type CalendarDensity = "COMFORTABLE" | "STANDARD" | "COMPACT";
export type CalendarCurrencyDisplay = "SYMBOL" | "CODE" | "HIDDEN";

export interface CalendarPreferences {
  density: CalendarDensity;
  showGuestName: boolean;
  showGuestCount: boolean;
  showChannel: boolean;
  showAmount: boolean;
  showReservationId: boolean;
  showNotes: boolean;
  currencyDisplay: CalendarCurrencyDisplay;
  reservationColors: "BRIGHT" | "CALM";
  collapsedRoomTypeIds: string[];
}

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  density: "STANDARD",
  showGuestName: true,
  showGuestCount: true,
  showChannel: true,
  showAmount: false,
  showReservationId: false,
  showNotes: false,
  currencyDisplay: "SYMBOL",
  reservationColors: "BRIGHT",
  collapsedRoomTypeIds: [],
};

export interface CalendarFilters {
  roomTypeId: string;
  channelId: string;
  statusId: string;
}
