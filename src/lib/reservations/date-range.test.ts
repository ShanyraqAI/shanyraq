import assert from "node:assert/strict";
import test from "node:test";
import {
  monthDays,
  nightlyTotal,
  selectRangeDay,
  staysConflict,
  validBookingRange,
} from "./date-range";

const stay = {
  checkIn: "2026-10-10",
  checkOut: "2026-10-14",
  checkInTime: "14:00",
  checkOutTime: "12:00",
};
test("two taps only produce a range, third tap starts again", () => {
  let range = selectRangeDay({ checkIn: "", checkOut: "" }, "2026-10-30");
  assert.deepEqual(range, { checkIn: "2026-10-30", checkOut: "" });
  range = selectRangeDay(range, "2026-11-02");
  assert.deepEqual(range, { checkIn: "2026-10-30", checkOut: "2026-11-02" });
  assert.deepEqual(selectRangeDay(range, "2026-11-03"), {
    checkIn: "2026-11-03",
    checkOut: "",
  });
});
test("earlier or equal second tap becomes arrival, invalid date does not erase input", () => {
  const range = { checkIn: "2026-10-30", checkOut: "" };
  assert.deepEqual(selectRangeDay(range, "2026-10-28"), {
    checkIn: "2026-10-28",
    checkOut: "",
  });
  assert.deepEqual(selectRangeDay(range, "2026-10-30"), range);
  assert.deepEqual(selectRangeDay(range, "2026-02-30"), range);
});
test("departure is not occupied, but boundary times cannot overlap", () => {
  assert.equal(
    staysConflict(stay, {
      ...stay,
      checkIn: "2026-10-14",
      checkOut: "2026-10-16",
    }),
    false,
  );
  assert.equal(
    staysConflict(stay, {
      ...stay,
      checkIn: "2026-10-14",
      checkOut: "2026-10-16",
      checkInTime: "11:59",
    }),
    true,
  );
  assert.equal(
    staysConflict(stay, {
      ...stay,
      checkIn: "2026-10-14",
      checkOut: "2026-10-16",
      checkInTime: "12:00",
    }),
    false,
  );
  assert.equal(
    staysConflict(stay, {
      ...stay,
      checkIn: "2026-10-08",
      checkOut: "2026-10-10",
      checkOutTime: "14:01",
    }),
    true,
  );
});
test("partial and enclosing overlaps are rejected symmetrically", () => {
  for (const [checkIn, checkOut] of [
    ["2026-10-09", "2026-10-11"],
    ["2026-10-13", "2026-10-15"],
    ["2026-10-09", "2026-10-15"],
    ["2026-10-11", "2026-10-12"],
  ]) {
    const other = { ...stay, checkIn, checkOut };
    assert.equal(staysConflict(stay, other), true);
    assert.equal(staysConflict(other, stay), true);
  }
});
test("month grid is Monday-first, leap-year and year boundary safe", () => {
  const october = monthDays("2026-10-14");
  assert.equal(october[3], "2026-10-01");
  assert.equal(october.filter(Boolean).length, 31);
  assert.equal(october.length % 7, 0);
  assert.ok(monthDays("2028-02-01").includes("2028-02-29"));
  assert.equal(
    validBookingRange({ checkIn: "2026-12-31", checkOut: "2027-01-02" }),
    true,
  );
});
test("invalid, zero-night and excessive booking periods fail validation", () => {
  for (const range of [
    { checkIn: "2026-02-30", checkOut: "2026-03-01" },
    { checkIn: "2026-10-10", checkOut: "2026-10-10" },
    { checkIn: "2026-10-10", checkOut: "2027-10-12" },
  ])
    assert.equal(validBookingRange(range), false);
});
test("nightly rates override base price, checkout rate is not charged", () => {
  assert.equal(
    nightlyTotal(10000, "2026-12-31", "2027-01-03", [
      { date: "2026-12-31", price: 15000 },
      { date: "2027-01-01", price: 20000 },
      { date: "2027-01-03", price: 90000 },
    ]),
    45000,
  );
  assert.equal(nightlyTotal(0.1, "2026-10-10", "2026-10-13", []), 0.3);
});
test("checkout on an occupied arrival date is valid only before its arrival time", () => {
  assert.equal(
    staysConflict(stay, {
      ...stay,
      checkIn: "2026-10-08",
      checkOut: "2026-10-10",
      checkOutTime: "12:00",
    }),
    false,
  );
});
