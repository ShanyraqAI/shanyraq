import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORT_REQUEST_STATUSES, SUPPORT_STATUS_LABELS, supportResolutionDate } from "./workflow";

test("support workflow exposes the three closed-beta states", () => {
  assert.deepEqual(SUPPORT_REQUEST_STATUSES, ["OPEN", "REVIEWING", "RESOLVED"]);
  assert.equal(SUPPORT_STATUS_LABELS.OPEN, "Новое");
  assert.equal(SUPPORT_STATUS_LABELS.REVIEWING, "В работе");
  assert.equal(SUPPORT_STATUS_LABELS.RESOLVED, "Решено");
});

test("only a resolved request receives a resolution timestamp", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");
  assert.equal(supportResolutionDate("OPEN", now), null);
  assert.equal(supportResolutionDate("REVIEWING", now), null);
  assert.equal(supportResolutionDate("RESOLVED", now), now);
});
