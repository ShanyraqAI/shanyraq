import test from "node:test";
import assert from "node:assert/strict";
import { dispatchOfflineAction } from "./dispatch";
import { setOutboxScope, readOutbox, ACTIVE_SCOPE_KEY } from "./outbox";
import type { MutationContext } from "./mutation-context";
const items = new Map<string, string>();
let online = true;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => items.set(k, v),
      removeItem: (k: string) => items.delete(k),
      key: (i: number) => [...items.keys()][i] ?? null,
      get length() {
        return items.size;
      },
    },
    dispatchEvent: () => true,
  },
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    get onLine() {
      return online;
    },
  },
});
test("response lost AFTER successful server write queues the exact original key", async () => {
  items.clear();
  online = true;
  setOutboxScope("user:hotel");
  let sent: MutationContext | undefined;
  const result = await dispatchOfflineAction(
    "guest.note",
    "note",
    [{ content: "text" }],
    async (context) => {
      sent = context;
      throw new TypeError("Failed to fetch");
    },
  );
  assert.equal(result.queued, true);
  const [entry] = readOutbox();
  assert.equal(entry.id, sent?.key);
  assert.equal(entry.scope, sent?.scope);
  assert.deepEqual(entry.args, [{ content: "text" }]);
});
test("changing hotel during a lost response cannot enqueue into a new context", async () => {
  items.clear();
  online = true;
  setOutboxScope("user:A");
  const result = await dispatchOfflineAction(
    "guest.note",
    "note",
    [],
    async () => {
      window.localStorage.setItem(ACTIVE_SCOPE_KEY, "user:B");
      throw new TypeError("NetworkError");
    },
  );
  assert.equal(result.ok, false);
  assert.equal(readOutbox().length, 0);
});
test("offline initial request queues once without calling server", async () => {
  items.clear();
  online = false;
  setOutboxScope("user:A");
  let called = false;
  const result = await dispatchOfflineAction(
    "guest.note",
    "note",
    [],
    async () => {
      called = true;
      return { ok: true };
    },
  );
  assert.equal(called, false);
  assert.equal(result.queued, true);
  assert.equal(readOutbox().length, 1);
  online = true;
});
test("business failure is not silently queued for replay", async () => {
  items.clear();
  setOutboxScope("user:A");
  const result = await dispatchOfflineAction(
    "guest.note",
    "note",
    [],
    async () => ({ ok: false, error: "denied" }),
  );
  assert.equal(result.ok, false);
  assert.equal(readOutbox().length, 0);
});
