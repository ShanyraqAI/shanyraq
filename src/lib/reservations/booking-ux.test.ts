import assert from "node:assert/strict";
import test from "node:test";
import { calendarStayPosition } from "./calendar-range";
import { parseISODate } from "../dates";
import { staysConflict, nightlyTotal } from "./date-range";
const start = parseISODate("2026-10-17");
test("arrival and departure use exact half-day placement, not whole-day bars", () => {
  assert.deepEqual(calendarStayPosition("2026-10-17", "2026-10-19", start, 7, 42, 0), { left: 21, width: 84, clippedStart: false, clippedEnd: false });
});
test("departure on first visible day retains its morning half", () => {
  assert.deepEqual(calendarStayPosition("2026-10-16", "2026-10-17", start, 7, 42, 0), { left: 0, width: 21, clippedStart: true, clippedEnd: false });
});
test("same-day turnover bars remain separate", () => {
  const a = calendarStayPosition("2026-10-17", "2026-10-18", start, 7, 42)!;
  const b = calendarStayPosition("2026-10-18", "2026-10-19", start, 7, 42)!;
  assert.ok(a.left + a.width < b.left);
});
test("viewport and month boundaries are clipped, including last-day arrivals", () => {
  assert.equal(calendarStayPosition("2026-10-15", "2026-10-16", start, 7, 42), null);
  assert.equal(calendarStayPosition("2026-10-24", "2026-10-25", start, 7, 42), null);
  const end = calendarStayPosition("2026-10-23", "2026-10-25", start, 7, 42)!;
  assert.equal(end.clippedEnd, true);
  assert.ok(end.left + end.width <= 7 * 42);
});
test("visual halves do not relax time conflicts or change nightly pricing", () => {
  const existing = { checkIn: "2026-10-16", checkOut: "2026-10-17", checkInTime: "14:00", checkOutTime: "12:00" };
  const candidate = { checkIn: "2026-10-17", checkOut: "2026-10-19", checkInTime: "14:00", checkOutTime: "12:00" };
  assert.equal(staysConflict(existing, candidate), false);
  assert.equal(staysConflict(existing, { ...candidate, checkInTime: "11:00" }), true);
  assert.equal(nightlyTotal(100, candidate.checkIn, candidate.checkOut, [{ date: "2026-10-19", price: 900 }]), 200);
});
