const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 15 * 60_000;

/** Exponential retry delay: 30s, 1m, 2m, 4m, 8m, then capped at 15m. */
export function channelSyncRetryDelayMs(attempt: number): number {
  const exponent = Math.max(0, Math.min(20, Math.trunc(attempt) - 1));
  return Math.min(MAX_RETRY_DELAY_MS, BASE_RETRY_DELAY_MS * 2 ** exponent);
}

export function channelSyncBatchSize(requested: number): number {
  if (!Number.isFinite(requested)) return 1;
  return Math.max(1, Math.min(25, Math.trunc(requested)));
}

export function channelSyncDeduplicationKey(connectionId: string): string {
  return `channel-sync:${connectionId}`;
}
