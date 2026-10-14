import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingFromCalendarHref,
  calendarSelectionHref,
  initialBookingStep,
} from "./calendar-navigation";

test("apartment and timeline-date taps open Calendar, not the booking wizard", () => {
  assert.equal(
    calendarSelectionHref("r1"),
    "/dashboard/calendar/select?roomId=r1",
  );
  assert.equal(
    calendarSelectionHref("r1", "2026-12-31"),
    "/dashboard/calendar/select?roomId=r1&checkIn=2026-12-31",
  );
  assert.equal(
    calendarSelectionHref(undefined, "2026-12-31"),
    "/dashboard/calendar/select?checkIn=2026-12-31",
  );
  assert.equal(calendarSelectionHref(), "/dashboard/calendar/select");
});
test("navigation safely encodes apartment identity and rejects invalid seed dates", () => {
  const url = new URL(
    calendarSelectionHref("room&admin=1", "2026-02-30"),
    "https://example.test",
  );
  assert.equal(url.searchParams.get("roomId"), "room&admin=1");
  assert.equal(url.searchParams.get("checkIn"), null);
  assert.equal(url.searchParams.has("admin"), false);
});
test("only Continue transfers the completed range and exact apartment", () => {
  const range = { checkIn: "2026-12-31", checkOut: "2027-01-03" };
  const url = new URL(
    bookingFromCalendarHref(range, "r1"),
    "https://example.test",
  );
  assert.equal(url.pathname, "/dashboard/reservations/new");
  assert.equal(url.searchParams.get("datesSelected"), "1");
  assert.equal(url.searchParams.get("roomId"), "r1");
  assert.equal(url.searchParams.get("checkIn"), range.checkIn);
  assert.equal(url.searchParams.get("checkOut"), range.checkOut);
  assert.throws(() =>
    bookingFromCalendarHref({ checkIn: range.checkIn, checkOut: "" }),
  );
});
test("a completed selection skips duplicate date entry, not availability checks", () => {
  const range = { checkIn: "2026-12-31", checkOut: "2027-01-03" };
  assert.equal(initialBookingStep(range, true, "r1"), 3);
  assert.equal(initialBookingStep(range, true), 2);
  assert.equal(initialBookingStep(range, false, "r1"), 1);
  assert.equal(initialBookingStep({ ...range, checkOut: "" }, true, "r1"), 1);
});
