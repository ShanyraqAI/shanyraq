import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  ACTIVE_SCOPE_KEY,
  setOutboxScope,
  getOutboxScope,
  enqueueOutbox,
  scopedOutbox,
  readOutbox,
  removeOutboxEntry,
} from "./outbox";
const items = new Map<string, string>();
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
test("preallocated operation ID remains unchanged in persistent queue", () => {
  items.clear();
  setOutboxScope("user:A");
  const id = randomUUID();
  const saved = enqueueOutbox({
    id,
    scope: "user:A",
    kind: "reservation.create",
    args: [{}],
    label: "booking",
  });
  assert.equal(saved?.id, id);
  assert.equal(saved?.protocol, 2);
  assert.equal(scopedOutbox().length, 1);
});
test("switching account/hotel cannot enqueue under captured old scope", () => {
  setOutboxScope("user:A");
  window.localStorage.setItem(ACTIVE_SCOPE_KEY, "other:B");
  assert.equal(getOutboxScope(), null);
  assert.equal(
    enqueueOutbox({
      id: randomUUID(),
      scope: "user:A",
      kind: "guest.note",
      args: [{}],
      label: "note",
    }),
    null,
  );
});
test("queues for different hotel/users do not replay together", () => {
  items.clear();
  setOutboxScope("user:A");
  const one = randomUUID(),
    two = randomUUID();
  enqueueOutbox({
    id: one,
    scope: "user:A",
    kind: "guest.note",
    args: [{}],
    label: "A",
  });
  setOutboxScope("user:B");
  enqueueOutbox({
    id: two,
    scope: "user:B",
    kind: "guest.note",
    args: [{}],
    label: "B",
  });
  assert.deepEqual(
    scopedOutbox().map((e) => e.id),
    [two],
  );
  assert.equal(readOutbox().length, 2);
  removeOutboxEntry(one);
  assert.equal(readOutbox().length, 1);
});
test("malformed persisted entries are not trusted", () => {
  items.clear();
  window.localStorage.setItem(
    "shanyraq-offline-outbox-v1",
    '[null,{"id":3},{"args":[]}]',
  );
  assert.deepEqual(readOutbox(), []);
});

test("corrupt legacy JSON does not hide independent v2 entries", () => {
  items.clear();
  setOutboxScope("user:A");
  enqueueOutbox({
    id: randomUUID(),
    scope: "user:A",
    kind: "guest.note",
    args: [],
    label: "note",
  });
  window.localStorage.setItem("shanyraq-offline-outbox-v1", "{");
  assert.equal(readOutbox().length, 1);
});
