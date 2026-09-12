import assert from "node:assert/strict";
import test from "node:test";
import { formatCompactNightlyPrice, isNightlyPrice } from "./pricing";

test("nightly price accepts only the configured KZT range", () => {
  assert.equal(isNightlyPrice(999), false);
  assert.equal(isNightlyPrice(1_000), true);
  assert.equal(isNightlyPrice(999_000), true);
  assert.equal(isNightlyPrice(999_001), false);
});

test("compact prices never round a positive amount down to zero", () => {
  assert.equal(formatCompactNightlyPrice(25), "25 ₸");
  assert.equal(formatCompactNightlyPrice(25_000), "25 тыс.");
});
