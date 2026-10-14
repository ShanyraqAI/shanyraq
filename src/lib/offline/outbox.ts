/**
 * Device-side outbox for changes made without internet. Entries are replayed
 * through the regular server actions once the connection returns, so every
 * permission, tenant and double-booking check still runs on the server.
 */

export const OUTBOX_EVENT = "shanyraq-outbox-change";
export const ACTIVE_SCOPE_KEY = "shanyraq-active-device-scope";
const ENTRY_PREFIX = "shanyraq-offline-entry-v2:";
const STORAGE_KEY = "shanyraq-offline-outbox-v1";

export interface OutboxEntry {
  protocol?: 2;
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
  if (typeof window !== "undefined")
    window.localStorage.setItem(ACTIVE_SCOPE_KEY, scope);
}

export function getOutboxScope() {
  return typeof window !== "undefined" &&
    window.localStorage.getItem(ACTIVE_SCOPE_KEY) !== currentScope
    ? null
    : currentScope;
}

export function readOutbox(): OutboxEntry[] {
  if (typeof window === "undefined") return [];
  try {
    let legacy: unknown = [];
    try {
      legacy = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      /* corrupt legacy storage must not hide valid v2 entries */
    }
    const individual: unknown[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(ENTRY_PREFIX)) {
        try {
          individual.push(
            JSON.parse(window.localStorage.getItem(key) ?? "null"),
          );
        } catch {
          /* malformed item is not replayed */
        }
      }
    }
    const parsed = [...(Array.isArray(legacy) ? legacy : []), ...individual];
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry) =>
            entry &&
            typeof entry.id === "string" &&
            typeof entry.scope === "string" &&
            typeof entry.kind === "string" &&
            typeof entry.label === "string" &&
            typeof entry.createdAt === "string" &&
            Array.isArray(entry.args),
        )
      : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export function scopedOutbox(
  scope: string | null = getOutboxScope(),
): OutboxEntry[] {
  return scope ? readOutbox().filter((entry) => entry.scope === scope) : [];
}

export function enqueueOutbox(
  entry: Pick<OutboxEntry, "kind" | "args" | "label" | "id" | "scope">,
): OutboxEntry | null {
  if (!getOutboxScope() || entry.scope !== getOutboxScope()) return null;
  const saved: OutboxEntry = {
    ...entry,
    protocol: 2,
    createdAt: new Date().toISOString(),
  };
  // Independent keys prevent two tabs losing each other's entries in an array read/modify/write.
  window.localStorage.setItem(ENTRY_PREFIX + saved.id, JSON.stringify(saved));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
  return saved;
}

export function removeOutboxEntry(id: string) {
  window.localStorage.removeItem(ENTRY_PREFIX + id);
  writeOutbox(
    readOutbox().filter((entry) => entry.protocol !== 2 && entry.id !== id),
  );
}

export function updateOutboxEntry(
  id: string,
  patch: Partial<Pick<OutboxEntry, "error">>,
) {
  const entry = readOutbox().find((entry) => entry.id === id);
  if (entry?.protocol === 2) {
    window.localStorage.setItem(
      ENTRY_PREFIX + id,
      JSON.stringify({ ...entry, ...patch }),
    );
    window.dispatchEvent(new Event(OUTBOX_EVENT));
  } else
    writeOutbox(
      readOutbox()
        .filter((entry) => entry.protocol !== 2)
        .map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
}

export function clearScopedOutbox(scope: string | null = getOutboxScope()) {
  for (const entry of readOutbox().filter((entry) => entry.scope === scope))
    removeOutboxEntry(entry.id);
}

export function isDeviceOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Fetch failures surface as TypeError ("Failed to fetch", "Load failed", "NetworkError…"). */
export function isNetworkError(error: unknown) {
  if (isDeviceOffline()) return true;
  return (
    error instanceof TypeError &&
    /fetch|network|load failed/i.test(error.message)
  );
}
