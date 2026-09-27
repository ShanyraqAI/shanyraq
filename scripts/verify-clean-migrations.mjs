import { randomBytes } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required");

const databaseName = `shanyraq_rental_property_test_${randomBytes(6).toString("hex")}`;
if (!/^shanyraq_rental_property_test_[a-f0-9]{12}$/.test(databaseName)) throw new Error("Unsafe test database name");

const adminDb = new PrismaClient({ datasources: { db: { url: source } } });
const testUrl = new URL(source);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("schema", "public");
const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
let created = false;

try {
  await adminDb.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Clean migration deploy failed");

  const testDb = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });
  try {
    await testDb.rentalProperty.count();
    await testDb.roomType.count({ where: { rentalPropertyId: { not: "" } } });
  } finally {
    await testDb.$disconnect();
  }
  console.log("Clean database migration verification passed");
} finally {
  if (created) await adminDb.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await adminDb.$disconnect();
}
