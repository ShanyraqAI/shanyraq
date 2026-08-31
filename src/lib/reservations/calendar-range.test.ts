import assert from "node:assert/strict";
import test from "node:test";
import { parseISODate } from "@/lib/dates";
import { clipStay, staysOverlap } from "./calendar-range";

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
