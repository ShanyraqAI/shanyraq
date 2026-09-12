import assert from "node:assert/strict";
import test from "node:test";
import {
  BETA_HOTEL_STATUSES,
  BETA_HOTEL_STATUS_LABELS,
  betaStatusNeedsReason,
  nextBetaStartedAt,
} from "./beta";

test("every beta status has a Russian label", () => {
  assert.equal(BETA_HOTEL_STATUSES.length, 6);
  for (const status of BETA_HOTEL_STATUSES) assert.ok(BETA_HOTEL_STATUS_LABELS[status]);
});

test("pause and exit require an operating reason", () => {
  assert.equal(betaStatusNeedsReason("PAUSED"), true);
  assert.equal(betaStatusNeedsReason("LEFT"), true);
  assert.equal(betaStatusNeedsReason("ACTIVE"), false);
  assert.equal(betaStatusNeedsReason("ONBOARDING"), false);
});

test("first activation records its start and preserves an existing date", () => {
  const now = new Date("2026-09-12T10:00:00.000Z");
  const existing = new Date("2026-09-01T10:00:00.000Z");
  assert.equal(nextBetaStartedAt("ACTIVE", null, now), now);
  assert.equal(nextBetaStartedAt("ACTIVE", existing, now), existing);
  assert.equal(nextBetaStartedAt("INVITED", null, now), null);
});
