import assert from "node:assert/strict";
import test from "node:test";
import { bulkRateUpdateSchema } from "./constants";

const validInput = {
  ratePlanId: "rate-plan-1",
  from: "2026-10-01",
  to: "2026-10-07",
  price: 25_000,
  minStay: 2,
  minStayType: "ARRIVAL",
  maxStay: 14,
  stopSell: false,
  closedToArrival: false,
  closedToDeparture: false,
  weekendsOnly: false,
};

test("accepts daily rate restrictions for one date or a range", () => {
  assert.equal(bulkRateUpdateSchema.safeParse(validInput).success, true);
  assert.equal(bulkRateUpdateSchema.safeParse({ ...validInput, to: validInput.from, minStayType: "THROUGH" }).success, true);
  assert.equal(bulkRateUpdateSchema.safeParse({ ...validInput, maxStay: null }).success, true);
});

test("rejects invalid stays and reversed or oversized date ranges", () => {
  assert.equal(bulkRateUpdateSchema.safeParse({ ...validInput, minStay: 0 }).success, false);
  assert.equal(bulkRateUpdateSchema.safeParse({ ...validInput, maxStay: 1 }).success, false);
  assert.equal(bulkRateUpdateSchema.safeParse({ ...validInput, minStayType: "UNKNOWN" }).success, false);
  assert.equal(bulkRateUpdateSchema.safeParse({ ...validInput, from: "2026-10-08", to: "2026-10-07" }).success, false);
  assert.equal(bulkRateUpdateSchema.safeParse({ ...validInput, to: "2028-10-07" }).success, false);
});
