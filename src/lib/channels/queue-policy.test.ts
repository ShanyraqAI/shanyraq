import assert from "node:assert/strict";
import { test } from "node:test";
import {
  channelSyncBatchSize,
  channelSyncDeduplicationKey,
  channelSyncRetryDelayMs,
} from "./queue-policy";

test("channel sync retries back off and are capped", () => {
  assert.equal(channelSyncRetryDelayMs(1), 30_000);
  assert.equal(channelSyncRetryDelayMs(2), 60_000);
  assert.equal(channelSyncRetryDelayMs(5), 480_000);
  assert.equal(channelSyncRetryDelayMs(6), 900_000);
  assert.equal(channelSyncRetryDelayMs(100), 900_000);
});

test("worker batch size is always bounded", () => {
  assert.equal(channelSyncBatchSize(0), 1);
  assert.equal(channelSyncBatchSize(5.9), 5);
  assert.equal(channelSyncBatchSize(100), 25);
  assert.equal(channelSyncBatchSize(Number.NaN), 1);
});

test("one stable key deduplicates active work per connection", () => {
  assert.equal(channelSyncDeduplicationKey("connection-1"), "channel-sync:connection-1");
});
