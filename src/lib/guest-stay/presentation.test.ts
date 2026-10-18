import test from "node:test";
import assert from "node:assert/strict";
import {
  amenitiesList,
  selectionFromQuery,
  selectionQuery,
} from "./presentation";
test("amenities use only owner text, deduplicate and retain Unicode", () => {
  assert.deepEqual(amenitiesList("Wi-Fi, Парковка\nТерраса; Wi-Fi\n\n"), [
    "Wi-Fi",
    "Парковка",
    "Терраса",
  ]);
  assert.deepEqual(amenitiesList(""), []);
  assert.deepEqual(amenitiesList("<script>alert(1)</script>"), [
    "<script>alert(1)</script>",
  ]);
});
test("catalog links retain dates and guest count without preview privilege", () => {
  const selected = { checkIn: "2026-11-01", checkOut: "2026-11-04", guests: 2 };
  const query = new URLSearchParams(selectionQuery(selected));
  assert.deepEqual(selectionFromQuery(Object.fromEntries(query)), selected);
  assert.equal(selectionQuery(null), "");
  assert.equal(
    selectionFromQuery({
      checkIn: "2026-11-01",
      checkOut: "2026-11-04",
      guests: "oops",
    })?.guests,
    1,
  );
  assert.equal(
    selectionFromQuery({ checkIn: ["bad"], checkOut: "2026-11-04" }),
    undefined,
  );
});
