import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required");

const schemaName = `rental_property_test_${randomBytes(6).toString("hex")}`;
if (!/^rental_property_test_[a-f0-9]{12}$/.test(schemaName)) throw new Error("Unsafe test schema name");

const sourceUrl = new URL(source);
const testUrl = new URL(source);
testUrl.searchParams.set("schema", schemaName);

const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const migrationPath = path.join(process.cwd(), "prisma", "migrations", "20260924180000_rental_property_foundation", "migration.sql");
const baseDb = new PrismaClient({ datasources: { db: { url: sourceUrl.toString() } } });
const testDb = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });

function executeSql(sql) {
  const result = spawnSync(process.execPath, [prismaCli, "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    input: sql,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Prisma db execute failed");
}

const fixtureSql = `
CREATE TABLE "Organization" ("id" TEXT PRIMARY KEY);
CREATE TABLE "Hotel" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "propertyType" TEXT,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
  "currency" TEXT NOT NULL DEFAULT 'KZT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Hotel_id_orgId_key" UNIQUE ("id", "orgId"),
  CONSTRAINT "Hotel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
CREATE TABLE "RoomType" (
  "id" TEXT PRIMARY KEY,
  "hotelId" TEXT NOT NULL,
  CONSTRAINT "RoomType_id_hotelId_key" UNIQUE ("id", "hotelId"),
  CONSTRAINT "RoomType_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE
);
CREATE TABLE "Room" (
  "id" TEXT PRIMARY KEY,
  "hotelId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  CONSTRAINT "Room_id_hotelId_key" UNIQUE ("id", "hotelId"),
  CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE,
  CONSTRAINT "Room_roomTypeId_hotelId_fkey" FOREIGN KEY ("roomTypeId", "hotelId") REFERENCES "RoomType"("id", "hotelId") ON DELETE RESTRICT
);
CREATE TABLE "Reservation" (
  "id" TEXT PRIMARY KEY,
  "hotelId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  CONSTRAINT "Reservation_roomId_hotelId_fkey" FOREIGN KEY ("roomId", "hotelId") REFERENCES "Room"("id", "hotelId") ON DELETE RESTRICT,
  CONSTRAINT "Reservation_roomTypeId_hotelId_fkey" FOREIGN KEY ("roomTypeId", "hotelId") REFERENCES "RoomType"("id", "hotelId") ON DELETE RESTRICT
);
INSERT INTO "Organization" ("id") VALUES ('org-a'), ('org-b');
INSERT INTO "Hotel" ("id", "orgId", "name", "propertyType", "address", "city", "country", "timezone", "currency", "updatedAt") VALUES
  ('hotel-a', 'org-a', 'Алматы апарт-отель', 'Апарт-отель', 'Абая 1', 'Алматы', 'Казахстан', 'Asia/Almaty', 'KZT', CURRENT_TIMESTAMP),
  ('hotel-b', 'org-b', 'Астана апартаменты', 'Апартаменты', 'Кабанбай батыра 2', 'Астана', 'Казахстан', 'Asia/Almaty', 'KZT', CURRENT_TIMESTAMP);
INSERT INTO "RoomType" ("id", "hotelId") VALUES ('type-a', 'hotel-a'), ('type-b', 'hotel-b');
INSERT INTO "Room" ("id", "hotelId", "roomTypeId") VALUES ('room-a', 'hotel-a', 'type-a'), ('room-b', 'hotel-b', 'type-b');
INSERT INTO "Reservation" ("id", "hotelId", "roomId", "roomTypeId") VALUES
  ('reservation-a', 'hotel-a', 'room-a', 'type-a'),
  ('reservation-b', 'hotel-b', 'room-b', 'type-b');
`;

try {
  await baseDb.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
  executeSql(fixtureSql);
  executeSql(await readFile(migrationPath, "utf8"));

  const [counts] = await testDb.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM "Hotel") AS hotels,
      (SELECT COUNT(*)::int FROM "RentalProperty") AS properties,
      (SELECT COUNT(*)::int FROM "RoomType" WHERE "rentalPropertyId" IS NOT NULL) AS room_types,
      (SELECT COUNT(*)::int FROM "Room" WHERE "rentalPropertyId" IS NOT NULL) AS rooms,
      (SELECT COUNT(*)::int FROM "Reservation" WHERE "rentalPropertyId" IS NOT NULL) AS reservations
  `);
  assert.deepEqual(counts, { hotels: 2, properties: 2, room_types: 2, rooms: 2, reservations: 2 });

  const copied = await testDb.$queryRawUnsafe(`
    SELECT "internalName", "publicName", "propertyType", "address", "city", "country", "timezone", "currency", "inventoryMode"::text AS "inventoryMode"
    FROM "RentalProperty" WHERE "hotelId" = 'hotel-a'
  `);
  assert.deepEqual(copied, [{
    internalName: "Алматы апарт-отель",
    publicName: "Алматы апарт-отель",
    propertyType: "Апарт-отель",
    address: "Абая 1",
    city: "Алматы",
    country: "Казахстан",
    timezone: "Asia/Almaty",
    currency: "KZT",
    inventoryMode: "GROUPED_UNITS",
  }]);

  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "RentalProperty" ("id", "organizationId", "hotelId", "internalName", "publicName", "inventoryMode", "updatedAt")
    VALUES ('wrong-org', 'org-b', 'hotel-a', 'Wrong', 'Wrong', 'GROUPED_UNITS', CURRENT_TIMESTAMP)
  `));
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "RoomType" ("id", "hotelId", "rentalPropertyId")
    VALUES ('wrong-workspace', 'hotel-b', 'rp_hotel-a')
  `));
  await testDb.$executeRawUnsafe(`
    INSERT INTO "RentalProperty" ("id", "organizationId", "hotelId", "internalName", "publicName", "inventoryMode", "updatedAt")
    VALUES ('property-a-2', 'org-a', 'hotel-a', 'Second', 'Second', 'SINGLE_UNIT', CURRENT_TIMESTAMP)
  `);
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "Room" ("id", "hotelId", "rentalPropertyId", "roomTypeId")
    VALUES ('wrong-room-property', 'hotel-a', 'property-a-2', 'type-a')
  `));
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "Reservation" ("id", "hotelId", "rentalPropertyId", "roomId", "roomTypeId")
    VALUES ('wrong-reservation-property', 'hotel-a', 'property-a-2', 'room-a', 'type-a')
  `));
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "RoomType" ("id", "hotelId", "rentalPropertyId")
    VALUES ('missing-property', 'hotel-a', NULL)
  `));

  console.log("RentalProperty migration verification passed");
} finally {
  await testDb.$disconnect();
  await baseDb.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await baseDb.$disconnect();
}
