import { PrismaClient } from "@prisma/client";

const SOURCE_DATABASE = "neondb";
const ADMIN_DATABASE = process.env.E2E_DATABASE_NAME ?? "shanyraq_e2e_test";
const BACKUP_DATABASE = "shanyraq_neondb_pre_phase3_20260911_backup";
const MIGRATION = "20260911160000_phase3_onboarding_support";

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
    const [identity, objects, migration, billing, counts, migrations] = await Promise.all([
      db.$queryRawUnsafe("SELECT current_database() AS database, current_user AS role"),
      db.$queryRawUnsafe(`
        SELECT to_regclass('public."ProductExperience"')::text AS "productExperienceTable",
               to_regclass('public."SupportRequest"')::text AS "supportRequestTable"
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
               (SELECT count(*) FROM "ChannelSyncJob") AS "channelSyncJobs",
               (SELECT count(*) FROM "_prisma_migrations") AS migrations
      `),
      db.$queryRawUnsafe(`
        SELECT migration_name AS name, checksum, finished_at AS "finishedAt", rolled_back_at AS "rolledBackAt"
        FROM "_prisma_migrations" ORDER BY migration_name
      `),
    ]);

    const phase3Counts = objects[0]?.productExperienceTable && objects[0]?.supportRequestTable
      ? await db.$queryRawUnsafe(`
          SELECT (SELECT count(*) FROM "ProductExperience") AS experiences,
                 (SELECT count(*) FROM "SupportRequest") AS requests
        `)
      : null;

    return { identity, objects, migration, billing, counts, migrations, phase3Counts };
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
  if (before.objects[0]?.productExperienceTable || before.objects[0]?.supportRequestTable || before.migration.length) {
    throw new Error("Phase 3 objects or migration row already exist; refusing pre-migration backup mode");
  }

  const admin = client(ADMIN_DATABASE, true);
  try {
    const existing = await admin.$queryRawUnsafe(`SELECT datname FROM pg_database WHERE datname = '${BACKUP_DATABASE}'`);
    if (existing.length) throw new Error(`Backup ${BACKUP_DATABASE} already exists; refusing to overwrite it`);

    const active = await admin.$queryRawUnsafe(`
      SELECT pid, application_name, usename, state
      FROM pg_stat_activity WHERE datname = '${SOURCE_DATABASE}'
    `);
    const unsafe = active.filter((item) =>
      item.application_name !== "pgbouncer" || item.usename !== "neondb_owner" || item.state !== "idle"
    );
    if (unsafe.length) throw new Error(`Found ${unsafe.length} active or unexpected source sessions; no sessions were terminated`);

    if (active.length) {
      await admin.$queryRawUnsafe(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '${SOURCE_DATABASE}'
          AND application_name = 'pgbouncer'
          AND usename = 'neondb_owner'
          AND state = 'idle'
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
  const before = {
    experiences: await db.productExperience.count(),
    requests: await db.supportRequest.count(),
  };
  const membership = await db.membership.findFirst({
    select: { userId: true, organizationId: true, hotelId: true },
  });
  if (!membership?.hotelId) throw new Error("No hotel-scoped membership is available for the rollback probe");

  const rollback = new Error("ROLLBACK_PHASE3_PROBE");
  let observed;
  try {
    await db.$transaction(async (tx) => {
      const experience = await tx.productExperience.upsert({
        where: { userId_hotelId: { userId: membership.userId, hotelId: membership.hotelId } },
        create: { userId: membership.userId, hotelId: membership.hotelId },
        update: { lastSeenAt: new Date() },
        select: { id: true },
      });
      const request = await tx.supportRequest.create({
        data: {
          userId: membership.userId,
          organizationId: membership.organizationId,
          hotelId: membership.hotelId,
          category: "QUESTION",
          message: "Rollback-only Phase 3 schema verification",
          sourcePath: "/release-probe",
        },
        select: { id: true },
      });
      observed = { experience: Boolean(experience.id), request: Boolean(request.id) };
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    const after = {
      experiences: await db.productExperience.count(),
      requests: await db.supportRequest.count(),
    };
    await db.$disconnect();
    if (json(before) !== json(after)) throw new Error("Rollback probe changed Phase 3 row counts");
  }
  return { observed, persistedRowsAdded: 0 };
}

const mode = process.argv[2] ?? "preflight";
if (mode === "preflight" || mode === "verify") console.log(json(await inspect(SOURCE_DATABASE)));
else if (mode === "sessions") console.log(json(await sessions()));
else if (mode === "create-backup") console.log(json(await createBackup()));
else if (mode === "probe") console.log(json(await rollbackProbe()));
else throw new Error("Usage: phase3-release-gate.mjs [preflight|sessions|create-backup|verify|probe]");
