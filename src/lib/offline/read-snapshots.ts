/** Read copies only. This database never contains outbox entries or drafts. */
export const READ_SNAPSHOTS_CLEARED = "shanyraq-read-snapshots-cleared";
export const READ_SCHEMA = 1;
export const MAX_SNAPSHOT_BYTES = 256 * 1024;
export const MAX_SNAPSHOTS = 24;
export const SNAPSHOT_TTL = 7 * 24 * 60 * 60 * 1000;
const DB_NAME = "shanyraq-read-snapshots";
const STORE = "snapshots";
let generation = 0;
let opening: Promise<IDBDatabase> | undefined;

export interface ReadSnapshot<T> {
  key: string;
  scope: string;
  params: string;
  schema: 1;
  version: string;
  syncedAt: number;
  requestedAt: number;
  data: T;
}

export function snapshotKey(scope: string, resource: string, params: string) {
  return JSON.stringify([READ_SCHEMA, scope, resource, params]);
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB unavailable"));
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, READ_SCHEMA);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE, { keyPath: "key" });
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Local storage upgrade blocked"));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); opening = undefined; };
        resolve(db);
      };
    }).catch((error: unknown) => { opening = undefined; throw error; });
  }
  return opening;
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Local storage failed"));
  });
}

export async function loadReadSnapshot<T>(key: string, scope: string, params: string): Promise<ReadSnapshot<T> | null> {
  const token = generation;
  const db = await openDatabase();
  const record = await new Promise<ReadSnapshot<T> | undefined>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (generation !== token || !record || record.schema !== READ_SCHEMA || record.scope !== scope || record.params !== params ||
      !Number.isFinite(record.syncedAt) || !Number.isFinite(record.requestedAt) || Date.now() - record.syncedAt > SNAPSHOT_TTL || record.syncedAt > Date.now() + 60_000)
    return null;
  return record;
}

export async function saveReadSnapshot<T>(record: ReadSnapshot<T>): Promise<void> {
  if (new TextEncoder().encode(JSON.stringify(record)).byteLength > MAX_SNAPSHOT_BYTES)
    throw new Error("Local read snapshot exceeds size limit");
  const token = generation;
  const db = await openDatabase();
  if (token !== generation) return;
  const transaction = db.transaction(STORE, "readwrite");
  const done = complete(transaction);
  const store = transaction.objectStore(STORE);
  const current = store.get(record.key);
  current.onsuccess = () => {
    // Two tabs share the same device clock: an older request must not overwrite a newer snapshot.
    const previous = current.result as ReadSnapshot<T> | undefined;
    if (previous && previous.requestedAt > record.requestedAt) return;
    store.put(record);
    // Bound this separate read-only cache by age, count AND aggregate bytes.
    const all = store.getAll();
    all.onsuccess = () => {
      const records = (all.result as ReadSnapshot<unknown>[]).sort((a, b) => b.syncedAt - a.syncedAt);
      let bytes = 0;
      records.forEach((item, index) => {
        bytes += new TextEncoder().encode(JSON.stringify(item)).byteLength;
        if (index >= MAX_SNAPSHOTS || bytes > 4 * 1024 * 1024 || Date.now() - item.syncedAt > SNAPSHOT_TTL)
          store.delete(item.key);
      });
    };
  };
  await done;
}

/** Invalidate running loads/writes synchronously, before any awaited IndexedDB work. */
export async function clearReadSnapshots(scope?: string): Promise<void> {
  generation += 1;
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(READ_SNAPSHOTS_CLEARED, { detail: scope }));
  const db = await openDatabase();
  const transaction = db.transaction(STORE, "readwrite");
  const done = complete(transaction);
  const store = transaction.objectStore(STORE);
  if (!scope) store.clear();
  else {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if ((cursor.value as ReadSnapshot<unknown>).scope === scope) cursor.delete();
      cursor.continue();
    };
  }
  await done;
}
