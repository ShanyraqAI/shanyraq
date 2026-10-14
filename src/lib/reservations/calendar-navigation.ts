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
): string {
  if (!validBookingRange(range))
    throw new Error("Select a valid date range first");
  const params = new URLSearchParams({ ...range, datesSelected: "1" });
  if (roomId) params.set("roomId", roomId);
  return `/dashboard/reservations/new?${params}`;
}

/** A completed selection skips ONLY the date step, never server validation. */
export function initialBookingStep(
  range: DateRange,
  datesSelected: boolean,
  roomId?: string,
): 1 | 2 | 3 {
  return datesSelected && validBookingRange(range) ? (roomId ? 3 : 2) : 1;
}
