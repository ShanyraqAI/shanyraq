import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTurnaroundMap,
  formatTurnaroundDuration,
  suggestQuickBookingSlot,
  turnaroundMessage,
  turnaroundMinutes,
  type TimedCalendarStay,
} from "./calendar-turnaround";

const stays: TimedCalendarStay[] = [
  { id: "previous", roomId: "101", checkIn: "2026-09-12", checkOut: "2026-09-14", checkInTime: "14:00", checkOutTime: "12:00" },
  { id: "next", roomId: "101", checkIn: "2026-09-16", checkOut: "2026-09-18", checkInTime: "14:00", checkOutTime: "12:00" },
];

test("turnaround duration detects normal, short and overlapping changeovers", () => {
  assert.equal(turnaroundMinutes("2026-09-14", "12:00", "2026-09-14", "14:00"), 120);
  assert.equal(turnaroundMinutes("2026-09-14", "13:30", "2026-09-14", "14:00"), 30);
  assert.equal(turnaroundMinutes("2026-09-14", "15:00", "2026-09-14", "14:00"), -60);
  assert.equal(formatTurnaroundDuration(120), "2 часа");
  assert.equal(turnaroundMessage(30), "⚠ 30 мин. на подготовку");
  assert.equal(turnaroundMessage(-60), "⚠ Пересечение 1 час");
});

test("quick booking fills the free range between neighboring reservations", () => {
  assert.deepEqual(suggestQuickBookingSlot(stays, "101", "2026-09-14"), {
    checkIn: "2026-09-14",
    checkOut: "2026-09-16",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    minutesAfterPrevious: 120,
    minutesBeforeNext: 120,
  });
  assert.equal(suggestQuickBookingSlot(stays, "101", "2026-09-15")?.checkOut, "2026-09-16");
  assert.equal(suggestQuickBookingSlot(stays, "101", "2026-09-16"), null);
});

test("turnaround map connects only same-room stays sharing one calendar date", () => {
  const map = buildTurnaroundMap([
    stays[0],
    { ...stays[1], checkIn: "2026-09-14", checkInTime: "14:00" },
    { id: "other-room", roomId: "102", checkIn: "2026-09-14", checkOut: "2026-09-15", checkInTime: "13:00", checkOutTime: "11:00" },
  ]);
  assert.equal(map.get("previous"), 120);
  assert.equal(map.has("other-room"), false);
});
