import { test } from "node:test";
import assert from "node:assert/strict";
import { ReadResource } from "./read-resource";
import { snapshotKey, MAX_SNAPSHOT_BYTES, saveReadSnapshot, type ReadSnapshot } from "./read-snapshots";

type Data = { rows: string[] };
const scope = '["user","org","hotel","OWNER",["OVERVIEW"]]';
const params = '["2026-10-16","ru"]';
const key = snapshotKey(scope, "test", params);
const saved = (rows = ["saved"]): ReadSnapshot<Data> => ({ key, scope, params, schema: 1, syncedAt: Date.now(), requestedAt: Date.now(), version: '"v1"', data: { rows } });
const response = (rows: string[] = ["fresh"]) => Response.json({ scope, params, version: '"v2"', data: { rows } });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; };
function resource(fetcher: typeof fetch, load: () => Promise<ReadSnapshot<Data> | null> = async () => saved(), save: (record: ReadSnapshot<Data>) => Promise<void> = async () => {}, denied: (status: number) => void = () => {}) {
  return new ReadResource<Data>({ scope, params, resource: "test", url: "/test", validate: (data): data is Data => !!data && typeof data === "object" && Array.isArray((data as Data).rows), fetcher, persistence: { load, save }, onDenied: denied, retry: false });
}

test("selection keys isolate users, organizations, permissions, dates and filters", () => {
  assert.notEqual(snapshotKey(scope, "test", params), snapshotKey("another-user", "test", params));
  assert.notEqual(snapshotKey(scope, "test", params), snapshotKey(scope, "test", "other-day-or-filter"));
  assert.notEqual(snapshotKey(scope, "test", params), snapshotKey(scope, "another-section", params));
});

test("local data appears while a network response is still pending", async () => {
  const network = deferred<Response>();
  const r = resource((async () => network.promise) as typeof fetch);
  const flight = r.refresh();
  await r.hydrate();
  assert.deepEqual(r.getSnapshot().snapshot?.data.rows, ["saved"]);
  assert.equal(r.getSnapshot().refreshing, true);
  network.resolve(response()); await flight;
  assert.deepEqual(r.getSnapshot().snapshot?.data.rows, ["fresh"]);
});

test("identical simultaneous requests are deduplicated", async () => {
  let calls = 0; const network = deferred<Response>();
  const r = resource((async () => { calls += 1; return network.promise; }) as typeof fetch);
  const first = r.refresh(); const second = r.refresh();
  assert.equal(first, second); assert.equal(calls, 1);
  network.resolve(response()); await first;
});

test("failed refresh preserves visible data", async () => {
  const r = resource((async () => new Response(null, { status: 503 })) as typeof fetch);
  await r.hydrate(); await r.refresh();
  assert.deepEqual(r.getSnapshot().snapshot?.data.rows, ["saved"]);
  assert.ok(r.getSnapshot().error);
});

test("successful empty data replaces old rows rather than behaving as an error", async () => {
  const r = resource((async () => response([])) as typeof fetch);
  await r.hydrate(); await r.refresh();
  assert.deepEqual(r.getSnapshot().snapshot?.data.rows, []);
  assert.equal(r.getSnapshot().error, null);
});

test("late hydration cannot overwrite newer server data", async () => {
  const disk = deferred<ReadSnapshot<Data> | null>();
  const r = resource((async () => response()) as typeof fetch, () => disk.promise);
  const hydration = r.hydrate(); await r.refresh(); disk.resolve(saved()); await hydration;
  assert.deepEqual(r.getSnapshot().snapshot?.data.rows, ["fresh"]);
});

test("scope change discards a late network result", async () => {
  const network = deferred<Response>(); let persisted = 0;
  const r = resource((async () => network.promise) as typeof fetch, async () => null, async () => { persisted += 1; });
  const flight = r.refresh(); r.stop(); network.resolve(response()); await flight;
  assert.equal(r.getSnapshot().snapshot, null); assert.equal(persisted, 0);
});

test("scope change discards a late local load", async () => {
  const disk = deferred<ReadSnapshot<Data> | null>();
  const r = resource((async () => response()) as typeof fetch, () => disk.promise);
  const hydration = r.hydrate(); r.stop(); disk.resolve(saved()); await hydration;
  assert.equal(r.getSnapshot().snapshot, null);
});

for (const status of [401, 403, 409]) test(`${status} stops reads and clears visible data`, async () => {
  let denied: number | undefined;
  const r = resource((async () => new Response(null, { status })) as typeof fetch, async () => saved(), async () => {}, (value) => { denied = value; });
  await r.hydrate(); await r.refresh();
  assert.equal(denied, status); assert.equal(r.getSnapshot().snapshot, null);
});

test("a different response scope is rejected", async () => {
  let denied: number | undefined;
  const r = resource((async () => Response.json({ scope: "other-org", params, version: "v2", data: { rows: ["private"] } })) as typeof fetch, async () => saved(), async () => {}, (value) => { denied = value; });
  await r.hydrate(); await r.refresh();
  assert.equal(denied, 409); assert.equal(r.getSnapshot().snapshot, null);
});

test("304 updates freshness without replacing data", async () => {
  const r = resource((async (_url, init) => {
    assert.equal((init?.headers as Record<string, string>)["If-None-Match"], '"v1"');
    return new Response(null, { status: 304 });
  }) as typeof fetch);
  await r.hydrate(); await r.refresh();
  assert.deepEqual(r.getSnapshot().snapshot?.data.rows, ["saved"]);
  assert.equal(r.getSnapshot().error, null);
});

test("quota/storage failures retain the useful in-memory copy with an explicit warning", async () => {
  const r = resource((async () => response()) as typeof fetch, async () => { throw new Error("denied"); }, async () => { throw new Error("quota"); });
  await r.hydrate(); await r.refresh();
  assert.deepEqual(r.getSnapshot().snapshot?.data.rows, ["fresh"]);
  assert.equal(r.getSnapshot().persistenceError, true);
});

test("failed requests respect backoff instead of restarting on every render/event", async () => {
  let calls = 0;
  const r = resource((async () => { calls += 1; return new Response(null, { status: 503 }); }) as typeof fetch);
  await r.refresh(); await r.refresh(); await r.refresh();
  assert.equal(calls, 1);
});

test("oversized snapshots are rejected before opening IndexedDB", async () => {
  await assert.rejects(saveReadSnapshot(saved(["x".repeat(MAX_SNAPSHOT_BYTES)])), /size limit/);
});
