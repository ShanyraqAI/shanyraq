import assert from "node:assert/strict";
import test from "node:test";
import { groupMobileReservations } from "./mobile-groups";

const today = "2026-10-02";
const tomorrow = "2026-10-03";

test("today includes departures, arrivals, and ongoing stays", () => {
  const reservations = [
    { id: "departure", checkIn: "2026-09-30", checkOut: today },
    { id: "arrival", checkIn: today, checkOut: tomorrow },
    { id: "ongoing", checkIn: "2026-10-01", checkOut: "2026-10-04" },
  ];
  const groups = groupMobileReservations(reservations, today, tomorrow);
  assert.deepEqual(groups.map((group) => group.key), ["today"]);
  assert.deepEqual(groups[0].rows.map((row) => row.id), ["departure", "ongoing", "arrival"]);
});

test("a departures-only result is not lost during mobile grouping", () => {
  const reservations = [
    { checkIn: "2026-09-30", checkOut: today },
    { checkIn: "2026-10-01", checkOut: tomorrow },
  ];
  const departures = reservations.filter((row) => row.checkOut === today);
  assert.deepEqual(groupMobileReservations(departures, today, tomorrow)[0].rows, departures);
});

test("every matching reservation appears once, including history, without mutating input", () => {
  const reservations = [
    { id: "later", checkIn: "2026-10-04", checkOut: "2026-10-05" },
    { id: "older", checkIn: "2026-09-01", checkOut: "2026-09-03" },
    { id: "tomorrow", checkIn: tomorrow, checkOut: "2026-10-04" },
    { id: "recent", checkIn: "2026-09-28", checkOut: "2026-10-01" },
    { id: "today", checkIn: "2026-10-01", checkOut: today },
  ];
  const original = [...reservations];
  const groups = groupMobileReservations(reservations, today, tomorrow);
  assert.deepEqual(groups.map((group) => group.key), ["today", "tomorrow", "later", "earlier"]);
  assert.deepEqual(groups.at(-1)?.rows.map((row) => row.id), ["recent", "older"]);
  const displayed = groups.flatMap((group) => group.rows.map((row) => row.id));
  assert.equal(displayed.length, reservations.length);
  assert.deepEqual([...displayed].sort(), reservations.map((row) => row.id).sort());
  assert.deepEqual(reservations, original);
});

test("empty results have no groups", () => {
  assert.deepEqual(groupMobileReservations([], today, tomorrow), []);
});
