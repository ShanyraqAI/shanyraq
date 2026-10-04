import assert from "node:assert/strict";
import test from "node:test";
import { calculateCommission, calculateOutstanding, depositOperations, summarizeOperations } from "./finance";

test("deposit cash movements belong to the period in which they happened", () => {
  const from = new Date("2030-01-01T00:00:00Z");
  const toExclusive = new Date("2030-02-01T00:00:00Z");
  const rows = [
    { depositAmount: 100, currency: "KZT", depositCollectedAt: new Date("2029-12-20T10:00:00Z"), depositReturnedAt: new Date("2030-01-05T10:00:00Z") },
    { depositAmount: 50, currency: "KZT", depositCollectedAt: new Date("2030-01-31T23:00:00Z"), depositReturnedAt: new Date("2030-02-01T00:00:00Z") },
  ];
  assert.deepEqual(depositOperations(rows, from, toExclusive), [
    { amount: 100, currency: "KZT", type: "REFUND", status: "COMPLETED" },
    { amount: 50, currency: "KZT", type: "PAYMENT", status: "COMPLETED" },
  ]);
});

test("uses actual Channex commission when present", () => {
  assert.deepEqual(calculateCommission({ bookingAmount: 1000, channexCommission: 125, ratePercent: 12, fixedFee: 3, currencyMatches: true }), { amount: 125, source: "CHANNEX" });
});

test("estimates commission only from an explicitly configured rate and fee", () => {
  assert.deepEqual(calculateCommission({ bookingAmount: 1000, channexCommission: null, ratePercent: 12.5, fixedFee: 50, currencyMatches: true }), { amount: 175, source: "ESTIMATED" });
  assert.equal(calculateCommission({ bookingAmount: 1000, channexCommission: null, ratePercent: 12.5, fixedFee: 0, currencyMatches: false }).amount, null);
  assert.equal(calculateCommission({ bookingAmount: 1000, channexCommission: null, ratePercent: null, fixedFee: null, currencyMatches: true }).amount, null);
});

test("summarizes partial payments, refunds, expenses, and excludes pending and foreign currency", () => {
  assert.deepEqual(summarizeOperations([
    { amount: 100, currency: "KZT", type: "PAYMENT", status: "COMPLETED" },
    { amount: 30, currency: "KZT", type: "PAYMENT", status: "PENDING" },
    { amount: 20, currency: "KZT", type: "REFUND", status: "COMPLETED" },
    { amount: 10, currency: "KZT", type: "EXPENSE", status: "COMPLETED" },
    { amount: 5, currency: "USD", type: "PAYMENT", status: "COMPLETED" },
  ], "KZT"), { paid: 100, refunded: 20, expenses: 10, currencies: ["KZT", "USD"] });
});

test("does not guess receivable for OTA collection or cancelled bookings", () => {
  assert.equal(calculateOutstanding({ amount: 100, collected: 30, refunded: 0, paymentCollect: "property", status: "CONFIRMED" }), 70);
  assert.equal(calculateOutstanding({ amount: 100, collected: 50, refunded: 20, paymentCollect: "property", status: "CONFIRMED" }), 70);
  assert.equal(calculateOutstanding({ amount: 100, collected: 0, refunded: 0, paymentCollect: "ota", status: "CONFIRMED" }), null);
  assert.equal(calculateOutstanding({ amount: 100, collected: 0, refunded: 0, paymentCollect: "property", status: "CANCELLED" }), null);
  assert.equal(calculateOutstanding({ amount: 100, collected: 0, refunded: 0, paymentCollect: null, status: "CONFIRMED" }), null);
});
