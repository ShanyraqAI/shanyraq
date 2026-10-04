/**
 * Device-side outbox for changes made without internet. Entries are replayed
 * through the regular server actions once the connection returns, so every
 * permission, tenant and double-booking check still runs on the server.
 */

export const OUTBOX_EVENT = "shanyraq-outbox-change";
const STORAGE_KEY = "shanyraq-offline-outbox-v1";

export interface OutboxEntry {
  id: string;
  kind: string;
  args: unknown[];
  label: string;
  /** `${userId}:${hotelId}` — entries never replay into another account or property. */
  scope: string;
  createdAt: string;
  error?: string;
}

let currentScope: string | null = null;

export function setOutboxScope(scope: string) {
  currentScope = scope;
}

export function getOutboxScope() {
  return currentScope;
}

export function readOutbox(): OutboxEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export function scopedOutbox(scope: string | null = currentScope): OutboxEntry[] {
  return scope ? readOutbox().filter((entry) => entry.scope === scope) : [];
}

export function enqueueOutbox(entry: Pick<OutboxEntry, "kind" | "args" | "label">): OutboxEntry | null {
  if (!currentScope) return null;
  const saved: OutboxEntry = { ...entry, id: crypto.randomUUID(), scope: currentScope, createdAt: new Date().toISOString() };
  writeOutbox([...readOutbox(), saved]);
  return saved;
}

export function removeOutboxEntry(id: string) {
  writeOutbox(readOutbox().filter((entry) => entry.id !== id));
}

export function updateOutboxEntry(id: string, patch: Partial<Pick<OutboxEntry, "error">>) {
  writeOutbox(readOutbox().map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
}

export function clearScopedOutbox(scope: string | null = currentScope) {
  writeOutbox(readOutbox().filter((entry) => entry.scope !== scope));
}

export function isDeviceOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Fetch failures surface as TypeError ("Failed to fetch", "Load failed", "NetworkError…"). */
export function isNetworkError(error: unknown) {
  if (isDeviceOffline()) return true;
  return error instanceof TypeError && /fetch|network|load failed/i.test(error.message);
}
