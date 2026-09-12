import { PrismaClient } from "@prisma/client";

const SOURCE_DATABASE = "neondb";
const ADMIN_DATABASE = process.env.E2E_DATABASE_NAME ?? "shanyraq_e2e_test";
const BACKUP_DATABASE = "shanyraq_neondb_pre_access_20260911_backup";
const MIGRATION = "20260911180000_granular_access";

function databaseUrl(database, direct = false) {
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error("DATABASE_URL is required");
  const url = new URL(source);
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
    const [identity, columns, migration, billing, counts, migrations] = await Promise.all([
      db.$queryRawUnsafe("SELECT current_database() AS database, current_user AS role"),
      db.$queryRawUnsafe(`
        SELECT table_name AS table, column_name AS column, data_type AS type, is_nullable AS nullable, column_default AS "default"
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND ((table_name = 'Membership' AND column_name = 'permissions')
            OR (table_name = 'HotelInvitation' AND column_name = 'permissions'))
        ORDER BY table_name
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
               (SELECT count(*) FROM "Membership") AS memberships,
               (SELECT count(*) FROM "HotelInvitation") AS invitations,
               (SELECT count(*) FROM "_prisma_migrations") AS migrations
      `),
      db.$queryRawUnsafe(`
        SELECT migration_name AS name, checksum, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
        FROM "_prisma_migrations" ORDER BY migration_name
      `),
    ]);
    return { identity, columns, migration, billing, counts, migrations };
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
  if (before.columns.length || before.migration.length) throw new Error("Granular access columns or migration row already exist; refusing pre-migration backup mode");
  const admin = client(ADMIN_DATABASE, true);
  try {
    const existing = await admin.$queryRawUnsafe(`SELECT datname FROM pg_database WHERE datname = '${BACKUP_DATABASE}'`);
    if (existing.length) throw new Error(`Backup ${BACKUP_DATABASE} already exists; refusing to overwrite it`);
    const active = await admin.$queryRawUnsafe(`SELECT pid, application_name, usename, state FROM pg_stat_activity WHERE datname = '${SOURCE_DATABASE}'`);
    const unsafe = active.filter((item) => item.application_name !== "pgbouncer" || item.usename !== "neondb_owner" || item.state !== "idle");
    if (unsafe.length) throw new Error(`Found ${unsafe.length} active or unexpected source sessions; no sessions were terminated`);
    if (active.length) {
      await admin.$queryRawUnsafe(`
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = '${SOURCE_DATABASE}' AND application_name = 'pgbouncer'
          AND usename = 'neondb_owner' AND state = 'idle'
      `);
    }
    await admin.$executeRawUnsafe(`CREATE DATABASE "${BACKUP_DATABASE}" WITH TEMPLATE "${SOURCE_DATABASE}"`);
  } finally {
    await admin.$disconnect();
  }
  const backup = await inspect(BACKUP_DATABASE);
  if (json(before.counts) !== json(backup.counts) || json(before.migrations) !== json(backup.migrations)) {
    throw new Error("Backup verification failed: source and backup metadata differ");
  }
  return { source: before, backup };
}

async function rollbackProbe() {
  const db = client(SOURCE_DATABASE);
  const membership = await db.membership.findFirst({ select: { id: true, permissions: true } });
  if (!membership) throw new Error("No membership is available for the rollback probe");
  const rollback = new Error("ROLLBACK_ACCESS_PROBE");
  let observed = false;
  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.membership.update({ where: { id: membership.id }, data: { permissions: ["CALENDAR", "GUESTS"] }, select: { permissions: true } });
      observed = updated.permissions.join(",") === "CALENDAR,GUESTS";
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    const after = await db.membership.findUniqueOrThrow({ where: { id: membership.id }, select: { permissions: true } });
    await db.$disconnect();
    if (json(after.permissions) !== json(membership.permissions)) throw new Error("Rollback probe changed membership permissions");
  }
  return { observed, persistedRowsChanged: 0 };
}

const mode = process.argv[2] ?? "preflight";
if (mode === "preflight" || mode === "verify") console.log(json(await inspect(SOURCE_DATABASE)));
else if (mode === "sessions") console.log(json(await sessions()));
else if (mode === "create-backup") console.log(json(await createBackup()));
else if (mode === "probe") console.log(json(await rollbackProbe()));
else throw new Error("Usage: granular-access-release-gate.mjs [preflight|sessions|create-backup|verify|probe]");
