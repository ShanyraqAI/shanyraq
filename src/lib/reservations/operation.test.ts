import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  executeOperation,
  operationHash,
  validateMutationContext,
} from "./operation";
function database() {
  let state = {
    rows: 0,
    receipts: new Map<
      string,
      { action: string; requestHash: string; resultJson: string }
    >(),
  };
  let tail = Promise.resolve();
  const client = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      const before = tail;
      let done!: () => void;
      tail = new Promise<void>((r) => {
        done = r;
      });
      await before;
      const candidate = { rows: state.rows, receipts: new Map(state.receipts) };
      const tx = {
        increment: () => ++candidate.rows,
        $queryRaw: async () => [],
        operationReceipt: {
          findUnique: async ({
            where,
          }: {
            where: { userId_hotelId_key: object };
          }) =>
            candidate.receipts.get(JSON.stringify(where.userId_hotelId_key)) ??
            null,
          create: async ({
            data,
          }: {
            data: {
              userId: string;
              hotelId: string;
              key: string;
              action: string;
              requestHash: string;
              resultJson: string;
            };
          }) => {
            candidate.receipts.set(
              JSON.stringify({
                userId: data.userId,
                hotelId: data.hotelId,
                key: data.key,
              }),
              data,
            );
          },
        },
      };
      try {
        const result = await work(tx);
        state = candidate;
        return result;
      } finally {
        done();
      }
    },
  } as unknown as PrismaClient;
  return { client, state: () => state };
}
const identity = { userId: "user", hotelId: "hotel" };
const context = () => ({ key: randomUUID(), scope: "user:hotel" });
test("hash survives JSON serialization and object key ordering", () => {
  assert.equal(
    operationHash("create", { b: 2, a: 1, optional: undefined }),
    operationHash("create", { a: 1, b: 2 }),
  );
  assert.notEqual(operationHash("create", {}), operationHash("note", {}));
});
test("scope and UUID must match the authenticated server identity", () => {
  validateMutationContext(undefined, "user", "hotel");
  assert.throws(() =>
    validateMutationContext(
      { ...context(), scope: "user:other" },
      "user",
      "hotel",
    ),
  );
  assert.throws(() =>
    validateMutationContext({ ...context(), key: "invalid" }, "user", "hotel"),
  );
});
test("lost response replay returns same ID without a second write", async () => {
  const d = database(),
    c = context();
  let effects = 0;
  const write = async (tx: unknown, defer: (fn: () => void) => void) => {
    const id = (tx as { increment: () => number }).increment();
    defer(() => {
      effects++;
    });
    return { ok: true, data: { id } };
  };
  const first = await executeOperation(
    d.client,
    identity,
    c,
    "create",
    { name: "same" },
    write,
  );
  const retry = await executeOperation(
    d.client,
    identity,
    c,
    "create",
    { name: "same" },
    write,
  );
  assert.deepEqual(retry, first);
  assert.equal(d.state().rows, 1);
  assert.equal(effects, 1);
});
test("concurrent same-key callers receive one result", async () => {
  const d = database(),
    c = context();
  const write = async (tx: unknown) => ({
    ok: true,
    data: { id: (tx as { increment: () => number }).increment() },
  });
  const results = await Promise.all(
    [1, 2].map(() =>
      executeOperation(d.client, identity, c, "note", {}, write),
    ),
  );
  assert.deepEqual(results[0], results[1]);
  assert.equal(d.state().rows, 1);
});
test("same key cannot execute different arguments or action", async () => {
  const d = database(),
    c = context();
  const write = async () => ({ ok: true });
  await executeOperation(d.client, identity, c, "create", {}, write);
  await assert.rejects(
    executeOperation(d.client, identity, c, "note", {}, write),
  );
  await assert.rejects(
    executeOperation(d.client, identity, c, "create", { changed: true }, write),
  );
});
test("failure after business write rolls back receipt and data; retry succeeds", async () => {
  const d = database(),
    c = context();
  await assert.rejects(
    executeOperation(d.client, identity, c, "create", {}, async (tx) => {
      (tx as unknown as { increment: () => number }).increment();
      throw new Error("audit write failed");
    }),
  );
  assert.equal(d.state().rows, 0);
  assert.equal(d.state().receipts.size, 0);
  await executeOperation(d.client, identity, c, "create", {}, async () => ({
    ok: true,
  }));
  assert.equal(d.state().receipts.size, 1);
});
test("returned failure also rolls back partial writes", async () => {
  const d = database();
  const response = await executeOperation(
    d.client,
    identity,
    context(),
    "create",
    {},
    async (tx) => {
      (tx as unknown as { increment: () => number }).increment();
      return { ok: false, error: "rejected" };
    },
  );
  assert.equal(response.ok, false);
  assert.equal(d.state().rows, 0);
  assert.equal(d.state().receipts.size, 0);
});
test("post-commit failure cannot change successful result", async () => {
  const d = database();
  const response = await executeOperation(
    d.client,
    identity,
    context(),
    "create",
    {},
    async (_, defer) => {
      defer(() => {
        throw new Error("notification unavailable");
      });
      return { ok: true, data: { id: "booking" } };
    },
  );
  assert.equal(response.ok, true);
  assert.equal(d.state().receipts.size, 1);
});
