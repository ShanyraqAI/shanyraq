import assert from "node:assert/strict";
import test from "node:test";
import { calculateUnitFinance } from "./units";

const d = (value: string) => new Date(`${value}T00:00:00Z`);

test("unit profit counts only nights inside the period and subtracts commission and expenses", () => {
  const filters = { from: d("2026-04-01"), to: d("2026-04-30"), source: null };
  // 30 Mar – 5 Apr: 6 nights, 4 of them in April (the checkout night is not counted).
  const reservations = [{ roomId: "a", checkIn: d("2026-03-30"), checkOut: d("2026-04-05"), status: "CONFIRMED", totalAmount: 60000, sourceChannel: "booking", currency: "KZT", otaCommissionAmount: 6000 },
    { roomId: "a", checkIn: d("2026-04-10"), checkOut: d("2026-04-12"), status: "CANCELLED", totalAmount: 99999, sourceChannel: "direct", currency: "KZT", otaCommissionAmount: null }];
  const [row, empty] = calculateUnitFinance([{ id: "a", number: "1" }, { id: "b", number: "2" }], reservations, [{ roomId: "a", amount: 2000, currency: "KZT" }], "KZT", filters);
  assert.equal(row.revenue, 40000);
  assert.equal(row.commission, 4000);
  assert.equal(row.profit, 40000 - 4000 - 2000);
  assert.equal(row.occupiedNights, 4);
  assert.equal(row.adr, 10000);
  assert.equal(row.revpar, 40000 / 30);
  assert.equal(empty.profit, 0);
});
