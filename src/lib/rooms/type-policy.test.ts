import assert from "node:assert/strict";
import test from "node:test";
import { inheritedTypeError } from "./type-policy";
const existing = { capacity: 2, basePrice: 25000 };
test("unchanged inherited values are accepted", () => {
  assert.equal(inheritedTypeError(existing, { ...existing }), null);
});
test("one unit cannot overwrite the category price", () => {
  assert.ok(inheritedTypeError(existing, { capacity: 2, basePrice: 30000 }));
});
test("one unit cannot overwrite the category capacity", () => {
  assert.ok(inheritedTypeError(existing, { capacity: 4, basePrice: 25000 }));
});
test("zero and fractional prices compare without rounding", () => {
  assert.ok(inheritedTypeError(existing, { capacity: 2, basePrice: 0 }));
  assert.ok(inheritedTypeError(existing, { capacity: 2, basePrice: 25000.01 }));
});
