import assert from "node:assert/strict";
import { test } from "node:test";
import { mockChannelProvidersEnabled } from "./runtime-policy";

test("mock channel providers are impossible in production", () => {
  assert.equal(mockChannelProvidersEnabled("production", "true"), false);
  assert.equal(mockChannelProvidersEnabled("production", "false"), false);
});

test("mock channel providers require an explicit local opt-in", () => {
  assert.equal(mockChannelProvidersEnabled("development", undefined), false);
  assert.equal(mockChannelProvidersEnabled("development", "false"), false);
  assert.equal(mockChannelProvidersEnabled("development", "true"), true);
});
