import { test } from "node:test";
import assert from "node:assert/strict";
import { overviewScope, overviewParams } from "./overview-types";
import { validateOverviewBlock } from "./overview-validation";

test("cache identity includes organization, hotel, role and normalized permissions", () => {
  const base = overviewScope("u", "o", "h", "OWNER", ["OVERVIEW", "CALENDAR"]);
  assert.equal(base, overviewScope("u", "o", "h", "OWNER", ["CALENDAR", "OVERVIEW"]));
  assert.notEqual(base, overviewScope("u", "other", "h", "OWNER", ["OVERVIEW", "CALENDAR"]));
  assert.notEqual(base, overviewScope("u", "o", "other", "OWNER", ["OVERVIEW", "CALENDAR"]));
  assert.notEqual(base, overviewScope("u", "o", "h", "STAFF", ["OVERVIEW"]));
  assert.notEqual(overviewParams({ day: "2026-10-16", locale: "ru" }), overviewParams({ day: "2026-10-17", locale: "ru" }));
});

test("empty supplemental results are valid, malformed data is not", () => {
  assert.equal(validateOverviewBlock("recent", []), true);
  assert.equal(validateOverviewBlock("attention", []), true);
  assert.equal(validateOverviewBlock("channels", []), true);
  assert.equal(validateOverviewBlock("recent", [{ id: "only-an-id" }]), false);
  assert.equal(validateOverviewBlock("core", { stats: {} }), false);
  assert.equal(validateOverviewBlock("core", null), false);
});

test("cached attention links cannot navigate to external origins", () => {
  const item = { label: "warning", room: "1", guest: "g", href: "https://evil.example" };
  assert.equal(validateOverviewBlock("attention", [item]), false);
  assert.equal(validateOverviewBlock("attention", [{ ...item, href: "/dashboard/rooms?room=1" }]), true);
});
