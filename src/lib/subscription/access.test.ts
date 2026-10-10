import assert from "node:assert/strict";
import test from "node:test";
import { grantPeriod, subscriptionStatus, whatsappRenewUrl } from "./access";

const now = new Date("2026-10-10T00:00:00Z");

test("status boundaries", () => {
  assert.equal(subscriptionStatus(null, now), "NONE");
  assert.equal(subscriptionStatus(now, now), "EXPIRED");
  assert.equal(subscriptionStatus(new Date("2026-10-17T00:00:00Z"), now), "EXPIRING");
  assert.equal(subscriptionStatus(new Date("2026-10-17T00:00:01Z"), now), "ACTIVE");
});

test("renewal stacks on remaining time, expired restarts from now", () => {
  const active = new Date("2026-10-20T00:00:00Z");
  assert.equal(grantPeriod(active, 1, now).endsAt.toISOString(), "2026-11-20T00:00:00.000Z");
  assert.equal(grantPeriod(new Date("2026-09-01T00:00:00Z"), 1, now).endsAt.toISOString(), "2026-11-10T00:00:00.000Z");
  assert.equal(grantPeriod(null, 12, now).endsAt.toISOString(), "2027-10-10T00:00:00.000Z");
});

test("whatsapp link targets the support number", () => {
  assert.ok(whatsappRenewUrl("Test").startsWith("https://wa.me/77087058827?text="));
});
