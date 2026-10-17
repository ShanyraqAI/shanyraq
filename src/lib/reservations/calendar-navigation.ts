import { isISODate } from "@/lib/dates";
import { validBookingRange, type DateRange } from "./date-range";

/** Selection lives inside Calendar; a tap must never open the booking form. */
export function calendarSelectionHref(
  roomId?: string,
  checkIn?: string,
): string {
  const params = new URLSearchParams();
  if (roomId) params.set("roomId", roomId);
  if (checkIn && isISODate(checkIn)) params.set("checkIn", checkIn);
  return `/dashboard/calendar/select${params.size ? `?${params}` : ""}`;
}

export function bookingFromCalendarHref(
  range: DateRange,
  roomId?: string,
  guests?: { adults: number; children: number },
): string {
  if (!validBookingRange(range))
    throw new Error("Select a valid date range first");
  const params = new URLSearchParams({ ...range, datesSelected: "1" });
  if (roomId) params.set("roomId", roomId);
  if (guests) {
    params.set("adults", String(guests.adults));
    params.set("children", String(guests.children));
  }
  return `/dashboard/reservations/new?${params}`;
}

/** Calendar is phase 1. A complete unit + period continues to Guest, never Price. */
export function initialBookingStep(
  range: DateRange,
  datesSelected: boolean,
  roomId?: string,
): 1 | 2 {
  return datesSelected && validBookingRange(range) && roomId ? 2 : 1;
}

/** Untrusted URL values are only form seeds, not availability or capacity proof. */
export function bookingGuestCount(value: unknown, fallback: number, min: number): number {
  if (typeof value !== "string" || !/^\d{1,2}$/.test(value)) return fallback;
  const count = Number(value);
  return count >= min && count <= 20 ? count : fallback;
}
