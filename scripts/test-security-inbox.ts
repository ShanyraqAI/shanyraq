/** Real PostgreSQL integration test. Never loads .env, resets a DB or accepts a remote URL. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { executeTelegramUpdate } from "../src/lib/telegram-admin/inbox";

const configured = process.env.SECURITY_TEST_DATABASE_URL;
if (!configured || process.env.SECURITY_TEST_DISPOSABLE !== "1") throw new Error("Explicit disposable test DB required");
const url = new URL(configured);
if (!["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !decodeURIComponent(url.pathname).endsWith("_test")) {
  throw new Error("Only a local disposable PostgreSQL database ending in _test is allowed");
}
const db = new PrismaClient({ datasourceUrl: configured });
const key = `security-inbox-test:${randomUUID()}`;
const firstId = Date.now() * 1000 + Math.floor(Math.random() * 500);
const ids = [BigInt(firstId), BigInt(firstId + 1)];
async function main() {
  try {
    await db.rateLimitBucket.create({ data: { key, count: 0, resetAt: new Date(Date.now() + 60_000) } });
    const write = async (tx: Prisma.TransactionClient) => {
      await tx.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } });
      return "synthetic response";
    };
    const responses = await Promise.all(Array.from({ length: 12 }, () =>
      executeTelegramUpdate(db, firstId, ["synthetic actor", "/grant test"], write)));
    assert.ok(responses.every(value => value === "synthetic response"));
    assert.equal((await db.rateLimitBucket.findUniqueOrThrow({ where: { key } })).count, 1);
    assert.equal(await db.telegramCommandReceipt.count({ where: { updateId: ids[0] } }), 1);
    console.log("PASS: 12 concurrent deliveries commit exactly one business mutation and receipt.");
    await assert.rejects(executeTelegramUpdate(db, firstId, ["changed identity"], write));
    assert.equal((await db.rateLimitBucket.findUniqueOrThrow({ where: { key } })).count, 1);
    console.log("PASS: update-id reuse with a different payload fails without another mutation.");
    await assert.rejects(executeTelegramUpdate(db, firstId + 1, ["rollback"], async (tx) => {
      await write(tx);
      throw new Error("synthetic command failure");
    }));
    assert.equal((await db.rateLimitBucket.findUniqueOrThrow({ where: { key } })).count, 1);
    assert.equal(await db.telegramCommandReceipt.count({ where: { updateId: ids[1] } }), 0);
    await executeTelegramUpdate(db, firstId + 1, ["rollback"], write);
    assert.equal((await db.rateLimitBucket.findUniqueOrThrow({ where: { key } })).count, 2);
    console.log("PASS: failed command rolls back business state and receipt; retry succeeds once.");
  } finally {
    await db.telegramCommandReceipt.deleteMany({ where: { updateId: { in: ids } } });
    await db.rateLimitBucket.deleteMany({ where: { key } });
    await db.$disconnect();
  }
}
main().catch(() => { console.error("Security inbox integration test failed; no production DB was targeted."); process.exitCode = 1; });
