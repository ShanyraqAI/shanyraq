import assert from "node:assert/strict";
import test from "node:test";
import { revisionDecision } from "./revision-order";
const prior = new Date("2026-10-14T12:00:00Z");
test("newer provider revision applies; late older revision cannot overwrite", () => {
  assert.equal(revisionDecision("2026-10-14T12:01:00Z", prior).apply, true);
  assert.equal(revisionDecision("2026-10-14T11:59:00Z", prior).apply, false);
});
test("first provider time applies without using receipt time", () => {
  assert.equal(revisionDecision("2020-01-01T00:00:00Z", null).apply, true);
});
test("ambiguous equal timestamp stops instead of ordering by UUID", () => {
  assert.throws(() => revisionDecision(prior.toISOString(), prior));
});
test("missing, invalid and timezone-less clocks fail closed", () => {
  for (const value of [
    null,
    "invalid",
    "2026-10-14T12:00:00",
    "2026-15-14T12:00:00Z",
  ])
    assert.throws(() => revisionDecision(value, prior));
});
