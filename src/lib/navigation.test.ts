import assert from "node:assert/strict";
import test from "node:test";
import { canOpenNavigation, isNavigationActive, mobileNavigationSection } from "./navigation";

test("limited staff cannot see forbidden links; owner and full access match server guards", () => {
  const staff = { permissions: ["ROOMS"] as const, accessLevel: "OVERVIEW" };
  assert.equal(canOpenNavigation(staff, "ROOMS"), true);
  assert.equal(canOpenNavigation(staff, "GUESTS"), false);
  assert.equal(canOpenNavigation(staff, ["REPORTS", "RESERVATIONS"]), false);
  assert.equal(canOpenNavigation(staff, "FULL"), false);
  assert.equal(canOpenNavigation({ ...staff, accessLevel: "FULL" }, "FULL"), true);
  assert.equal(canOpenNavigation({ ...staff, accessLevel: "FULL" }, "FULL", true), false);
  assert.equal(canOpenNavigation({ ...staff, isOwner: true }, "FULL", true), true);
});
test("payments and reports are mutually exclusive query-driven selections", () => {
  assert.equal(isNavigationActive("/dashboard/reports", "/dashboard/reports?tab=payments", "payments"), true);
  assert.equal(isNavigationActive("/dashboard/reports", "/dashboard/reports", "payments"), false);
  assert.equal(isNavigationActive("/dashboard/reports", "/dashboard/reports?tab=payments", null), false);
  assert.equal(isNavigationActive("/dashboard/reports", "/dashboard/reports", null), true);
});
test("apartment details keep apartment tab active; settings and profile belong to more", () => {
  for (const path of ["/dashboard/rooms", "/dashboard/rooms/123", "/dashboard/rooms/123/edit"]) assert.equal(mobileNavigationSection(path), "/dashboard/rooms");
  for (const path of ["/dashboard/settings", "/dashboard/reports", "/dashboard/profile"]) assert.equal(mobileNavigationSection(path), "/dashboard/more");
  assert.equal(mobileNavigationSection("/dashboard/reservations/new"), "/dashboard/reservations");
  assert.equal(isNavigationActive("/dashboard/rooms-other", "/dashboard/rooms"), false);
  assert.equal(isNavigationActive("/dashboard/rooms/123", "/dashboard"), false);
});
