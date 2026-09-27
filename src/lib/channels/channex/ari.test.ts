import assert from "node:assert/strict";
import test from "node:test";
import { parseISODate } from "@/lib/dates";
import { compressDailyValues } from "./ari";

test("compresses consecutive equal ARI values without joining gaps", () => {
  const rows = compressDailyValues([
    { date: parseISODate("2026-09-25"), value: { availability: 2 } },
    { date: parseISODate("2026-09-26"), value: { availability: 2 } },
    { date: parseISODate("2026-09-28"), value: { availability: 2 } },
    { date: parseISODate("2026-09-29"), value: { availability: 0 } },
  ], (range) => ({
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
    value: range.value.availability,
  }));
  assert.deepEqual(rows, [
    { from: "2026-09-25", to: "2026-09-26", value: 2 },
    { from: "2026-09-28", to: "2026-09-28", value: 2 },
    { from: "2026-09-29", to: "2026-09-29", value: 0 },
  ]);
});
