import { PrismaClient } from "@prisma/client";

const SOURCE_DATABASE = "neondb";
const ADMIN_DATABASE = process.env.E2E_DATABASE_NAME ?? "shanyraq_e2e_test";
const BACKUP_DATABASE = "shanyraq_neondb_pre_phase2_20260911_backup";
const MIGRATION = "20260911120000_phase2_observability";

function databaseUrl(database, direct = false) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  if (direct) url.hostname = url.hostname.replace("-pooler.", ".");
  return url.toString();
}

function client(database, direct = false) {
  return new PrismaClient({ datasourceUrl: databaseUrl(database, direct) });
}

function json(value) {
  return JSON.stringify(value, (_, item) => typeof item === "bigint" ? Number(item) : item, 2);
}

async function inspect(database) {
  const db = client(database);
  try {
    const [identity, objects, migration, billing, counts] = await Promise.all([
      db.$queryRawUnsafe("SELECT current_database() AS database, current_user AS role"),
      db.$queryRawUnsafe(`
        SELECT to_regclass('public."AnalyticsEvent"')::text AS "analyticsTable",
               EXISTS (
                 SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'platformRole'
               ) AS "platformRoleColumn"
      `),
      db.$queryRawUnsafe(`
        SELECT migration_name AS name, started_at AS "startedAt", finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
        FROM "_prisma_migrations" WHERE migration_name = '${MIGRATION}'
      `),
      db.$queryRawUnsafe(`
        SELECT conname AS name, pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conname IN ('BillingSubscription_organizationId_fkey','BillingPayment_organizationId_fkey','BillingNotice_organizationId_fkey')
        ORDER BY conname
      `),
      db.$queryRawUnsafe(`
        SELECT (SELECT count(*) FROM "User") AS users,
               (SELECT count(*) FROM "Hotel") AS hotels,
               (SELECT count(*) FROM "Room") AS rooms,
               (SELECT count(*) FROM "Reservation") AS reservations,
               (SELECT count(*) FROM "_prisma_migrations") AS migrations
      `),
    ]);
    const analytics = objects[0]?.analyticsTable
      ? await db.$queryRawUnsafe(`SELECT count(*) AS events FROM "AnalyticsEvent"`)
      : null;
    return { identity, objects, migration, billing, counts, analytics };
  } finally {
    await db.$disconnect();
  }
}

async function sessions() {
  const db = client(ADMIN_DATABASE);
  try {
    return db.$queryRawUnsafe(`
      SELECT application_name AS application, usename AS role, state, backend_type AS "backendType", count(*)::int AS count
      FROM pg_stat_activity WHERE datname = '${SOURCE_DATABASE}'
      GROUP BY application_name, usename, state, backend_type ORDER BY count(*) DESC, application_name
    `);
  } finally {
    await db.$disconnect();
  }
}

async function createBackup() {
  const before = await inspect(SOURCE_DATABASE);
  if (before.objects[0]?.analyticsTable || before.objects[0]?.platformRoleColumn || before.migration.length) {
    throw new Error("Phase 2 objects or migration row already exist; refusing pre-migration backup mode");
  }
  const admin = client(ADMIN_DATABASE, true);
  try {
    const existing = await admin.$queryRawUnsafe(`SELECT datname FROM pg_database WHERE datname = '${BACKUP_DATABASE}'`);
    if (existing.length) throw new Error(`Backup ${BACKUP_DATABASE} already exists; refusing to overwrite it`);
    const active = await admin.$queryRawUnsafe(`SELECT pid, application_name, usename, state FROM pg_stat_activity WHERE datname = '${SOURCE_DATABASE}'`);
    const unsafe = active.filter((item) => item.application_name !== "pgbouncer" || item.usename !== "neondb_owner" || item.state !== "idle");
    if (unsafe.length) throw new Error(`Found ${unsafe.length} active or unexpected source sessions; no sessions were terminated`);
    if (active.length) {
      await admin.$queryRawUnsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${SOURCE_DATABASE}' AND application_name = 'pgbouncer' AND usename = 'neondb_owner' AND state = 'idle'`);
    }
    await admin.$executeRawUnsafe(`CREATE DATABASE "${BACKUP_DATABASE}" WITH TEMPLATE "${SOURCE_DATABASE}"`);
  } finally {
    await admin.$disconnect();
  }
  const backup = await inspect(BACKUP_DATABASE);
  if (json(before.counts) !== json(backup.counts) || json(before.migration) !== json(backup.migration)) throw new Error("Backup verification failed");
  return { source: before, backup };
}

const mode = process.argv[2] ?? "preflight";
if (mode === "preflight") console.log(json(await inspect(SOURCE_DATABASE)));
else if (mode === "sessions") console.log(json(await sessions()));
else if (mode === "create-backup") console.log(json(await createBackup()));
else if (mode === "verify") console.log(json(await inspect(SOURCE_DATABASE)));
else throw new Error("Usage: phase2-release-gate.mjs [preflight|sessions|create-backup|verify]");
