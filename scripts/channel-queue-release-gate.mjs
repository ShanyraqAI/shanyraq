import { PrismaClient } from "@prisma/client";

const SOURCE_DATABASE = "neondb";
const ADMIN_DATABASE = "shanyraq_e2e_test";
const BACKUP_DATABASE = "shanyraq_neondb_pre_queue_20260911_backup";
const QUEUE_MIGRATION = "20260904000000_channel_sync_queue";

function databaseUrl(database) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

function client(database, { direct = false } = {}) {
  const url = new URL(databaseUrl(database));
  if (direct) url.hostname = url.hostname.replace("-pooler.", ".");
  return new PrismaClient({ datasourceUrl: url.toString() });
}

function json(value) {
  return JSON.stringify(value, (_, item) => typeof item === "bigint" ? Number(item) : item, 2);
}

async function inspect(database) {
  const db = client(database);
  try {
    const [identity, queueObjects, migration, billing, counts] = await Promise.all([
      db.$queryRawUnsafe("SELECT current_database() AS database, current_user AS role"),
      db.$queryRawUnsafe(`
        SELECT to_regclass('public."ChannelSyncJob"')::text AS "queueTable",
               to_regclass('public."ChannelConnection_id_hotelId_key"')::text AS "connectionIndex"
      `),
      db.$queryRawUnsafe(`
        SELECT migration_name AS name, started_at AS "startedAt", finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
        FROM "_prisma_migrations"
        WHERE migration_name = '${QUEUE_MIGRATION}'
      `),
      db.$queryRawUnsafe(`
        SELECT conname AS name, pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conname IN (
          'BillingSubscription_organizationId_fkey',
          'BillingPayment_organizationId_fkey',
          'BillingNotice_organizationId_fkey'
        )
        ORDER BY conname
      `),
      db.$queryRawUnsafe(`
        SELECT
          (SELECT count(*) FROM "User") AS users,
          (SELECT count(*) FROM "Hotel") AS hotels,
          (SELECT count(*) FROM "Room") AS rooms,
          (SELECT count(*) FROM "Reservation") AS reservations,
          (SELECT count(*) FROM "_prisma_migrations") AS migrations
      `),
    ]);
    const queue = queueObjects[0]?.queueTable
      ? {
          constraints: await db.$queryRawUnsafe(`
            SELECT conname AS name, pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE conname IN (
              'ChannelSyncJob_connectionId_hotelId_fkey',
              'ChannelSyncJob_hotelId_fkey'
            )
            ORDER BY conname
          `),
          health: await db.$queryRawUnsafe(`
            SELECT count(*) AS jobs,
                   count(*) FILTER (WHERE status IN ('PENDING', 'RUNNING')) AS active,
                   count(*) FILTER (WHERE status = 'FAILED') AS failed,
                   count(*) - count(DISTINCT "deduplicationKey") AS duplicates
            FROM "ChannelSyncJob"
          `),
        }
      : null;
    return { identity, queueObjects, migration, queue, billing, counts };
  } finally {
    await db.$disconnect();
  }
}

async function createBackup() {
  const admin = client(ADMIN_DATABASE, { direct: true });
  try {
    const existing = await admin.$queryRawUnsafe(
      `SELECT datname FROM pg_database WHERE datname = '${BACKUP_DATABASE}'`,
    );
    if (existing.length) throw new Error(`Backup database ${BACKUP_DATABASE} already exists; refusing to overwrite it.`);

    const sessions = await admin.$queryRawUnsafe(`
      SELECT pid, application_name AS application, usename AS role, state
      FROM pg_stat_activity
      WHERE datname = '${SOURCE_DATABASE}'
    `);
    const unsafeSessions = sessions.filter((session) =>
      session.application !== "pgbouncer" || session.role !== "neondb_owner" || session.state !== "idle"
    );
    if (unsafeSessions.length) {
      throw new Error(`Source database has ${unsafeSessions.length} non-idle or unexpected sessions; refusing to terminate them.`);
    }
    if (sessions.length) {
      await admin.$queryRawUnsafe(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${SOURCE_DATABASE}'
          AND application_name = 'pgbouncer'
          AND usename = 'neondb_owner'
          AND state = 'idle'
      `);
    }

    await admin.$executeRawUnsafe(
      `CREATE DATABASE "${BACKUP_DATABASE}" WITH TEMPLATE "${SOURCE_DATABASE}"`,
    );
  } finally {
    await admin.$disconnect();
  }

  const source = await inspect(SOURCE_DATABASE);
  const backup = await inspect(BACKUP_DATABASE);
  if (json(source.counts) !== json(backup.counts) || json(source.migration) !== json(backup.migration)) {
    throw new Error("Backup verification failed: source and backup metadata do not match.");
  }
  return { source, backup };
}

async function inspectSourceSessions() {
  const admin = client(ADMIN_DATABASE);
  try {
    return admin.$queryRawUnsafe(`
      SELECT application_name AS application, usename AS role, state, backend_type AS "backendType", count(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = '${SOURCE_DATABASE}'
      GROUP BY application_name, usename, state, backend_type
      ORDER BY count(*) DESC, application_name
    `);
  } finally {
    await admin.$disconnect();
  }
}

async function rollbackQueueProbe() {
  const db = client(SOURCE_DATABASE);
  const before = await db.channelSyncJob.count();
  const connection = await db.channelConnection.findFirst({
    where: {
      status: { in: ["CONNECTED", "ERROR"] },
      channel: { isInternal: false },
    },
    select: { id: true, hotelId: true },
  });
  if (!connection) throw new Error("No connected external channel is available for the rollback-only queue probe.");

  const rollback = new Error("ROLLBACK_QUEUE_PROBE");
  let observed;
  try {
    await db.$transaction(async (tx) => {
      const job = await tx.channelSyncJob.create({
        data: {
          connectionId: connection.id,
          hotelId: connection.hotelId,
          deduplicationKey: `release-probe:${crypto.randomUUID()}`,
        },
      });
      const running = await tx.channelSyncJob.update({
        where: { id: job.id },
        data: { status: "RUNNING", lockedAt: new Date(), lockedBy: "release-probe" },
      });
      const succeeded = await tx.channelSyncJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", finishedAt: new Date(), lockedAt: null, lockedBy: null },
      });
      observed = { created: job.status, claimed: running.status, completed: succeeded.status };
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    const after = await db.channelSyncJob.count();
    await db.$disconnect();
    if (after !== before) throw new Error(`Rollback probe changed queue row count from ${before} to ${after}.`);
  }
  return { observed, persistedRowsAdded: 0 };
}

const mode = process.argv[2] ?? "preflight";
if (mode === "preflight") {
  console.log(json(await inspect(SOURCE_DATABASE)));
} else if (mode === "create-backup") {
  console.log(json(await createBackup()));
} else if (mode === "sessions") {
  console.log(json(await inspectSourceSessions()));
} else if (mode === "probe") {
  console.log(json(await rollbackQueueProbe()));
} else {
  throw new Error("Usage: node --env-file=.env scripts/channel-queue-release-gate.mjs [preflight|sessions|create-backup|probe]");
}
