import { db } from "@/lib/db";
import { DB_INIT_SQL } from "@/lib/db-init-sql";
import { seedDemoData } from "@/lib/demo-seed";

/**
 * Runtime database bootstrap.
 *
 * Makes the app self-provisioning on an empty SQLite database:
 *   1. apply idempotent DDL (CREATE TABLE IF NOT EXISTS …)
 *   2. if the demo dataset is missing or incomplete, load it atomically
 *      (single transaction — concurrent instances can never leave a
 *      partially seeded database behind)
 *
 * Why: serverless hosts like Vercel give each lambda instance an ephemeral,
 * writable-only-in-/tmp filesystem. With DATABASE_URL pointing at /tmp, every
 * cold start begins from an empty file — this bootstrap turns that into a
 * fully seeded demo instead of a crash. Locally (persistent dev.db) both
 * steps are cheap no-ops.
 */

// Different page bundles can each carry a copy of this module — keep the
// single-flight promise on globalThis so there is exactly one per process.
const globalForBootstrap = globalThis as unknown as {
  __shanyraqDbReady?: Promise<void>;
};

export function ensureDatabaseReady(): Promise<void> {
  globalForBootstrap.__shanyraqDbReady ??= bootstrap().catch((error) => {
    // Allow a later request to retry after a transient failure.
    globalForBootstrap.__shanyraqDbReady = undefined;
    throw error;
  });
  return globalForBootstrap.__shanyraqDbReady;
}

async function bootstrap(): Promise<void> {
  await applyDDL();

  const [hotels, channels] = await Promise.all([db.hotel.count(), db.channel.count()]);
  // `Channel` rows are written at the very end of the seed — their presence
  // proves the dataset is complete, not half-written by an interrupted run.
  if (hotels === 0 || channels === 0) {
    try {
      await db.$transaction(
        async (tx) => {
          // The transaction client is API-compatible with PrismaClient for our
          // seeding calls; SQLite serializes writers so a concurrent instance
          // simply queues behind this one — no half-written datasets possible.
          await seedDemoData(tx as unknown as import("@prisma/client").PrismaClient);
        },
        { timeout: 60_000, maxWait: 10_000 },
      );
    } catch (error) {
      // A competing cold instance may have finished seeding while this one
      // waited on the SQLite write lock. Complete data = success; rethrow
      // only if the dataset is still missing.
      const [hotelsNow, channelsNow] = await Promise.all([db.hotel.count(), db.channel.count()]);
      if (hotelsNow === 0 || channelsNow === 0) throw error;
    }
  }
}

async function applyDDL(): Promise<void> {
  // Strip comment lines first — otherwise a chunk like
  //   "-- CreateTable\nCREATE TABLE …"
  // would be discarded wholesale.
  const withoutComments = DB_INIT_SQL.split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const statement of statements) {
    // CREATE ... IF NOT EXISTS makes re-runs safe.
    await db.$executeRawUnsafe(statement);
  }
}
