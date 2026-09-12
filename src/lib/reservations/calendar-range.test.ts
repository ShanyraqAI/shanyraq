import assert from "node:assert/strict";
import test from "node:test";
import { parseISODate, todayInTimeZone } from "@/lib/dates";
import {
  calendarTimelineRange,
  clipStay,
  formatCalendarRange,
  parseCalendarNavigation,
  shiftCalendarAnchor,
  staysOverlap,
} from "./calendar-range";

test("calendar timeline ranges stay anchored and bounded", () => {
  assert.deepEqual(calendarTimelineRange("2026-02-17", 7), {
    start: parseISODate("2026-02-17"),
    endExclusive: parseISODate("2026-02-24"),
    days: 7,
  });
  assert.deepEqual(calendarTimelineRange("2026-02-17", 14), {
    start: parseISODate("2026-02-17"),
    endExclusive: parseISODate("2026-03-03"),
    days: 14,
  });
  assert.deepEqual(calendarTimelineRange("2028-02-17", 30), {
    start: parseISODate("2028-02-17"),
    endExclusive: parseISODate("2028-03-18"),
    days: 30,
  });
});

test("previous and next move by exactly the selected range", () => {
  assert.equal(shiftCalendarAnchor("2026-09-10", 7, 1), "2026-09-17");
  assert.equal(shiftCalendarAnchor("2026-09-10", 7, -1), "2026-09-03");
  assert.equal(shiftCalendarAnchor("2026-09-10", 14, 1), "2026-09-24");
  assert.equal(shiftCalendarAnchor("2026-09-10", 14, -1), "2026-08-27");
  assert.equal(shiftCalendarAnchor("2026-09-10", 30, 1), "2026-10-10");
  assert.equal(shiftCalendarAnchor("2026-09-10", 30, -1), "2026-08-11");
});

test("range labels explain month, year and leap-year boundaries", () => {
  assert.equal(formatCalendarRange("2026-09-10", 7), "10 — 16 сентября 2026");
  assert.equal(formatCalendarRange("2026-09-24", 14), "24 сентября — 7 октября 2026");
  assert.equal(formatCalendarRange("2026-12-20", 30), "20 декабря 2026 — 18 января 2027");
  assert.equal(formatCalendarRange("2028-02-17", 14), "17 февраля — 1 марта 2028");
});

test("invalid URL navigation falls back while range changes preserve the anchor", () => {
  assert.deepEqual(parseCalendarNavigation("invalid", "month", "2026-09-10"), {
    anchorISO: "2026-09-10",
    rangeDays: 14,
  });
  assert.deepEqual(parseCalendarNavigation("2026-09-27", "30", "2026-09-10"), {
    anchorISO: "2026-09-27",
    rangeDays: 30,
  });
  assert.equal(parseCalendarNavigation("2026-09-27", "7", "2026-09-10").anchorISO, "2026-09-27");
});

test("hotel business date does not depend on the server timezone", () => {
  const instant = new Date("2026-09-10T20:30:00.000Z");
  assert.equal(todayInTimeZone("Asia/Almaty", instant).toISOString(), "2026-09-11T00:00:00.000Z");
  assert.equal(todayInTimeZone("America/New_York", instant).toISOString(), "2026-09-10T00:00:00.000Z");
});

test("calendar hides old/future stays and respects checkout at the visible boundary", () => {
  const start = parseISODate("2026-10-01");
  for (const [from, to] of [["2026-08-28", "2026-08-30"], ["2026-09-30", "2026-10-01"], ["2026-11-01", "2026-11-03"]]) {
    assert.equal(clipStay(from, to, start, 31), null);
  }
  assert.deepEqual(clipStay("2026-09-30", "2026-10-03", start, 31), { start: 0, end: 2, clippedStart: true });
  assert.deepEqual(clipStay("2026-10-31", "2026-11-03", start, 31), { start: 30, end: 31, clippedStart: false });
  assert.equal(clipStay("2026-09-30", "2026-10-01", start, 1), null);
  assert.deepEqual(clipStay("2026-09-30", "2026-10-03", start, 7), { start: 0, end: 2, clippedStart: true });
});

test("checkout/arrival on the same day are allowed; containment overlaps", () => {
  assert.equal(staysOverlap("2026-08-31", "2026-09-02", "2026-09-02", "2026-09-04"), false);
  assert.equal(staysOverlap("2026-08-31", "2026-09-05", "2026-09-02", "2026-09-04"), true);
});
