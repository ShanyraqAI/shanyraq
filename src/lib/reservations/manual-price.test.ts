import assert from "node:assert/strict";
import test from "node:test";
import { bookingPrice, MAX_BOOKING_TOTAL, parsePrice } from "./manual-price";

test("price input accepts local separators and converts to integer minor units", () => {
  for (const [input, expected] of [["20 000,50", 2000050], ["20\u202f000.05", 2000005], ["0", 0], ["0,1", 10]] as const) assert.equal(parsePrice(input), expected);
});
test("empty, negative, nonfinite, fractional and out-of-range inputs are rejected", () => {
  for (const input of ["", " ", "-1", "1e3", "NaN", "Infinity", "abc", "1,234", "1.2.3", "1000000001"]) assert.equal(parsePrice(input), null, input);
});
test("nightly override multiplies by nights exactly in minor units", () => {
  assert.equal(bookingPrice({ basis: "night", amount: "20000,05" }, 3, 999).total, 60000.15);
  assert.equal(bookingPrice({ basis: "night", amount: "20000,05" }, 5, 999).total, 100000.25);
});
test("stay override preserves total when dates change", () => {
  assert.equal(bookingPrice({ basis: "stay", amount: "100,01" }, 3, 0).total, 100.01);
  assert.equal(bookingPrice({ basis: "stay", amount: "100,01" }, 5, 0).total, 100.01);
});
test("unmodified quote preserves exact total rather than rounding nightly average", () => {
  const result = bookingPrice(null, 3, 100.01);
  assert.equal(result.total, 100.01);
  assert.equal(result.perNight, 33.34);
});
test("zero price supported; invalid duration and total cap stop submission", () => {
  assert.equal(bookingPrice({ basis: "night", amount: "0" }, 1, 0).valid, true);
  for (const nights of [0, -1, 1.5, Number.NaN]) assert.equal(bookingPrice(null, nights, 10).valid, false);
  assert.equal(bookingPrice({ basis: "stay", amount: String(MAX_BOOKING_TOTAL) }, 1, 0).valid, true);
  assert.equal(bookingPrice({ basis: "night", amount: String(MAX_BOOKING_TOTAL) }, 2, 0).valid, false);
  assert.equal(bookingPrice(null, 2, Number.NaN).valid, false);
});
