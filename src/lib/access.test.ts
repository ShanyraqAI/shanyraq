import assert from "node:assert/strict";
import test from "node:test";
import { accessLevelForPermissions, resolveHotelPermissions } from "./access";

test("stored granular permissions override the legacy access level", () => {
  assert.deepEqual(
    resolveHotelPermissions({ role: "STAFF", accessLevel: "FULL", permissions: ["CALENDAR", "GUESTS"] }),
    ["CALENDAR", "GUESTS"],
  );
  assert.equal(accessLevelForPermissions(["CALENDAR", "GUESTS"]), "OVERVIEW");
});

test("empty permissions preserve existing access and owners always receive full access", () => {
  assert.deepEqual(resolveHotelPermissions({ role: "STAFF", accessLevel: "CALENDAR", permissions: [] }), ["OVERVIEW", "CALENDAR"]);
  assert.equal(resolveHotelPermissions({ role: "OWNER", accessLevel: "OVERVIEW", permissions: [] }).length, 7);
});
