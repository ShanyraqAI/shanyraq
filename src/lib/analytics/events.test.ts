import assert from "node:assert/strict";
import test from "node:test";
import { isAnalyticsEventType, safeAnalyticsMetadata } from "./events";

test("analytics event names use the closed beta allowlist", () => {
  assert.equal(isAnalyticsEventType("reservation_created"), true);
  assert.equal(isAnalyticsEventType("password_reset"), false);
});

test("analytics metadata keeps only non-sensitive allowlisted values", () => {
  assert.deepEqual(
    safeAnalyticsMetadata({ method: "email", status: "ok", guestEmail: "private@example.com", token: "secret" }),
    { method: "email", status: "ok" },
  );
});
