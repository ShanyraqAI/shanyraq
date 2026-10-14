import type { CalendarStay } from "./date-range";
export interface BookingQuote {
  roomId: string;
  ratePlanId: string | null;
  total: number;
  currency: string;
}
export interface BookingOptions {
  scope: string;
  stays: CalendarStay[];
  quotes: BookingQuote[];
  checkedAt: string;
}
