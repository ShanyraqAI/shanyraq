// Temporary verification: full demo seed run against disposable e2e DB.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const raw = fs.readFileSync(".env", "utf8").match(/DATABASE_URL="?([^"\r\n]+)"?/)[1];
const url = new URL(raw);
url.pathname = "/shanyraq_e2e_test";
const e2eUrl = url.toString();

const { PrismaClient } = await import("@prisma/client");
const resetDb = new PrismaClient({ datasourceUrl: e2eUrl });
await resetDb.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
await resetDb.$executeRawUnsafe("CREATE SCHEMA public");
await resetDb.$disconnect();

function run(args) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: e2eUrl, ALLOW_DESTRUCTIVE_DB_RESET: "I_UNDERSTAND_THIS_DELETES_ALL_DATA", DISPOSABLE_DATABASE_NAME: "shanyraq_e2e_test" },
  });
  if (result.status !== 0) process.exit(1);
}

run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
run(["node_modules/tsx/dist/cli.mjs", "prisma/seed-demo.ts"]);

const db = new PrismaClient({ datasourceUrl: e2eUrl });
try {
  const [rooms, reservations, active] = await Promise.all([
    db.room.count(),
    db.reservation.count(),
    db.reservation.count({ where: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] } } }),
  ]);
  console.log(`SEED_OK rooms=${rooms} reservations=${reservations} active=${active}`);
} finally {
  await db.$disconnect();
}
