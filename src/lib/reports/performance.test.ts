import test from "node:test";
import assert from "node:assert/strict";
import { parseISODate } from "@/lib/dates";
import { calculatePerformance, parseReportFilters } from "./performance";

test("report prorates stay revenue across the selected nights", () => {
  const filters = { from: parseISODate("2026-09-02"), to: parseISODate("2026-09-03"), source: null };
  const report = calculatePerformance([{
    checkIn: parseISODate("2026-09-01"),
    checkOut: parseISODate("2026-09-05"),
    status: "CONFIRMED",
    totalAmount: 40_000,
    sourceChannel: "direct",
  }], 2, filters);

  assert.equal(report.summary.revenue, 20_000);
  assert.equal(report.summary.occupiedRoomNights, 2);
  assert.equal(report.summary.availableRoomNights, 4);
  assert.equal(report.summary.occupancy, 0.5);
  assert.equal(report.summary.adr, 10_000);
  assert.equal(report.summary.revpar, 5_000);
});

test("report source filter and cancelled stays do not inflate metrics", () => {
  const filters = { from: parseISODate("2026-09-01"), to: parseISODate("2026-09-01"), source: "direct" };
  const base = { checkIn: parseISODate("2026-09-01"), checkOut: parseISODate("2026-09-02"), totalAmount: 10_000 };
  const report = calculatePerformance([
    { ...base, status: "CONFIRMED", sourceChannel: "direct" },
    { ...base, status: "CONFIRMED", sourceChannel: "booking" },
    { ...base, status: "CANCELLED", sourceChannel: "direct" },
  ], 3, filters);

  assert.equal(report.summary.revenue, 10_000);
  assert.equal(report.summary.occupiedRoomNights, 1);
  assert.deepEqual(report.revenueBySource, [{ source: "direct", value: 10_000 }]);
});

test("invalid or oversized report periods fall back to the latest 30 days", () => {
  const today = parseISODate("2026-09-30");
  const invalid = parseReportFilters({ from: "2020-01-01", to: "2026-09-30", source: "all" }, today);
  assert.equal(invalid.from.toISOString(), parseISODate("2026-09-01").toISOString());
  assert.equal(invalid.to.toISOString(), today.toISOString());
  assert.equal(invalid.source, null);
});
