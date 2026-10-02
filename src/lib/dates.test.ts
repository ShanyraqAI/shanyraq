import assert from "node:assert/strict";
import { isValidTimeZone } from "./dates";

test("only real IANA time zones are accepted", () => {
  assert.equal(isValidTimeZone("Asia/Almaty"), true);
  assert.equal(isValidTimeZone("Invalid/Audit"), false);
  assert.equal(isValidTimeZone(""), false);
});
import test from "node:test";
import { formatISOCompactDate, formatISODate } from "./dates";

test("hotel dates are displayed with the day before the month", () => {
  assert.equal(formatISODate("2026-09-14"), "14.09.2026");
  assert.equal(formatISOCompactDate("2026-09-14"), "14.09");
});
