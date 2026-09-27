import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required");

const migrationName = "20260924210000_channex_per_rental_property";
const databaseName = `shanyraq_channex_property_test_${randomBytes(6).toString("hex")}`;
if (!/^shanyraq_channex_property_test_[a-f0-9]{12}$/.test(databaseName)) throw new Error("Unsafe test database name");

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "shanyraq-channex-migration-"));
const resolvedTemporaryRoot = path.resolve(temporaryRoot);
if (!resolvedTemporaryRoot.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolvedTemporaryRoot).startsWith("shanyraq-channex-migration-")) {
  throw new Error("Unsafe temporary migration directory");
}

const temporaryMigrations = path.join(temporaryRoot, "migrations");
const sourceMigrations = path.join(process.cwd(), "prisma", "migrations");
const temporarySchema = path.join(temporaryRoot, "schema.prisma");
const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const adminDb = new PrismaClient({ datasources: { db: { url: source } } });
const testUrl = new URL(source);
testUrl.pathname = `/${databaseName}`;
testUrl.searchParams.set("schema", "public");
let testDb;
let created = false;

function deploy() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", temporarySchema], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Migration deploy failed");
}

function executeSql(sql) {
  const result = spawnSync(process.execPath, [prismaCli, "db", "execute", "--stdin", "--schema", temporarySchema], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    input: sql,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || "Fixture SQL failed");
}

try {
  await mkdir(temporaryMigrations, { recursive: true });
  await cp(path.join(process.cwd(), "prisma", "schema.prisma"), temporarySchema);
  for (const entry of await readdir(sourceMigrations, { withFileTypes: true })) {
    if (entry.name >= migrationName) continue;
    await cp(path.join(sourceMigrations, entry.name), path.join(temporaryMigrations, entry.name), { recursive: entry.isDirectory() });
  }

  await adminDb.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  created = true;
  deploy();

  testDb = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });
  executeSql(`
    INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt") VALUES ('org-a', 'Test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "Hotel" ("id", "orgId", "slug", "name", "timezone", "currency", "createdAt", "updatedAt")
      VALUES ('hotel-a', 'org-a', 'hotel-a', 'Workspace', 'Asia/Almaty', 'KZT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "RentalProperty" ("id", "organizationId", "hotelId", "internalName", "publicName", "inventoryMode", "createdAt", "updatedAt") VALUES
      ('property-a', 'org-a', 'hotel-a', 'Property A', 'Property A', 'GROUPED_UNITS', CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP),
      ('property-b', 'org-a', 'hotel-a', 'Property B', 'Property B', 'SINGLE_UNIT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "RoomType" ("id", "hotelId", "rentalPropertyId", "name", "capacity", "basePrice") VALUES
      ('type-a', 'hotel-a', 'property-a', 'Type A', 2, 10000),
      ('type-b', 'hotel-a', 'property-b', 'Type B', 2, 12000);
    INSERT INTO "Room" ("id", "hotelId", "rentalPropertyId", "roomTypeId", "number") VALUES
      ('room-a', 'hotel-a', 'property-a', 'type-a', '101');
    INSERT INTO "Guest" ("id", "hotelId", "fullName") VALUES ('guest-a', 'hotel-a', 'Guest');
    INSERT INTO "RatePlan" ("id", "hotelId", "roomTypeId", "name", "basePrice", "currency")
      VALUES ('plan-a', 'hotel-a', 'type-a', 'Plan A', 10000, 'KZT');
    INSERT INTO "Reservation" ("id", "hotelId", "rentalPropertyId", "guestId", "roomId", "roomTypeId", "ratePlanId", "sourceChannel", "checkIn", "checkOut", "totalAmount", "createdAt", "updatedAt")
      VALUES ('reservation-a', 'hotel-a', 'property-a', 'guest-a', 'room-a', 'type-a', 'plan-a', 'direct', '2035-01-01', '2035-01-02', 10000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "ChannexProperty" ("id", "organizationId", "hotelId", "environment", "propertyId", "createdAt", "updatedAt")
      VALUES ('channex-a', 'org-a', 'hotel-a', 'STAGING', 'external-a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "ChannexRoomTypeMapping" ("id", "propertyRefId", "organizationId", "hotelId", "roomTypeId", "createdAt", "updatedAt")
      VALUES ('room-map-a', 'channex-a', 'org-a', 'hotel-a', 'type-a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "ChannexRatePlanMapping" ("id", "propertyRefId", "organizationId", "hotelId", "ratePlanId", "createdAt", "updatedAt")
      VALUES ('rate-map-a', 'channex-a', 'org-a', 'hotel-a', 'plan-a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "ChannexBooking" ("id", "propertyRefId", "organizationId", "hotelId", "reservationId", "channexBookingId", "uniqueId", "otaCode", "createdAt", "updatedAt")
      VALUES ('booking-a', 'channex-a', 'org-a', 'hotel-a', 'reservation-a', 'external-booking-a', 'unique-a', 'booking', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    INSERT INTO "ChannexBookingRevision" ("id", "propertyRefId", "organizationId", "hotelId", "bookingRecordId", "revisionId", "channexBookingId", "idempotencyKey", "eventType", "payload", "createdAt", "updatedAt")
      VALUES ('revision-a', 'channex-a', 'org-a', 'hotel-a', 'booking-a', 'revision-a', 'external-booking-a', 'idem-a', 'NEW', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  `);

  for (const entry of (await readdir(sourceMigrations, { withFileTypes: true })).filter((item) => item.name >= migrationName).sort((a, b) => a.name.localeCompare(b.name))) {
    await cp(path.join(sourceMigrations, entry.name), path.join(temporaryMigrations, entry.name), { recursive: entry.isDirectory() });
  }
  deploy();

  const [scope] = await testDb.$queryRawUnsafe(`
    SELECT
      (SELECT "rentalPropertyId" FROM "RatePlan" WHERE "id" = 'plan-a') AS rate_plan,
      (SELECT "rentalPropertyId" FROM "ChannexProperty" WHERE "id" = 'channex-a') AS property,
      (SELECT "rentalPropertyId" FROM "ChannexRoomTypeMapping" WHERE "id" = 'room-map-a') AS room_mapping,
      (SELECT "rentalPropertyId" FROM "ChannexRatePlanMapping" WHERE "id" = 'rate-map-a') AS rate_mapping,
      (SELECT "rentalPropertyId" FROM "ChannexBooking" WHERE "id" = 'booking-a') AS booking,
      (SELECT "rentalPropertyId" FROM "ChannexBookingRevision" WHERE "id" = 'revision-a') AS revision
  `);
  assert.deepEqual(scope, {
    rate_plan: "property-a",
    property: "property-a",
    room_mapping: "property-a",
    rate_mapping: "property-a",
    booking: "property-a",
    revision: "property-a",
  });
  const legacyLinks = await testDb.$queryRawUnsafe(`
    SELECT "bookingRecordId", "reservationId", "rentalPropertyId", "roomKey"
    FROM "ChannexBookingReservation" WHERE "bookingRecordId" = 'booking-a'
  `);
  assert.deepEqual(legacyLinks, [{
    bookingRecordId: "booking-a",
    reservationId: "reservation-a",
    rentalPropertyId: "property-a",
    roomKey: "legacy-primary",
  }]);

  await testDb.$executeRawUnsafe(`
    INSERT INTO "ChannexProperty" ("id", "organizationId", "hotelId", "rentalPropertyId", "environment", "propertyId", "createdAt", "updatedAt")
      VALUES ('channex-b', 'org-a', 'hotel-a', 'property-b', 'STAGING', 'external-b', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "ChannexRoomTypeMapping" ("id", "propertyRefId", "organizationId", "hotelId", "rentalPropertyId", "roomTypeId", "createdAt", "updatedAt")
      VALUES ('wrong-room-map', 'channex-b', 'org-a', 'hotel-a', 'property-b', 'type-a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `));
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "ChannexRatePlanMapping" ("id", "propertyRefId", "organizationId", "hotelId", "rentalPropertyId", "ratePlanId", "createdAt", "updatedAt")
      VALUES ('wrong-rate-map', 'channex-b', 'org-a', 'hotel-a', 'property-b', 'plan-a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `));
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "ChannexBooking" ("id", "propertyRefId", "organizationId", "hotelId", "rentalPropertyId", "reservationId", "channexBookingId", "uniqueId", "otaCode", "createdAt", "updatedAt")
      VALUES ('wrong-booking', 'channex-b', 'org-a', 'hotel-a', 'property-b', 'reservation-a', 'wrong', 'wrong', 'booking', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `));
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "RatePlan" ("id", "hotelId", "rentalPropertyId", "roomTypeId", "name", "basePrice", "currency")
      VALUES ('wrong-plan', 'hotel-a', 'property-b', 'type-a', 'Wrong', 1, 'KZT')
  `));
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "ChannexSyncJob" (
      "id", "propertyRefId", "organizationId", "hotelId", "rentalPropertyId",
      "roomTypeIds", "ratePlanIds", "dateFrom", "dateTo", "updatedAt"
    ) VALUES (
      'wrong-job', 'channex-b', 'org-a', 'hotel-a', 'property-a',
      '[]'::jsonb, '[]'::jsonb, '2035-01-01', '2035-01-02', CURRENT_TIMESTAMP
    )
  `));
  await assert.rejects(testDb.$executeRawUnsafe(`
    INSERT INTO "ChannexBookingReservation" (
      "id", "bookingRecordId", "reservationId", "organizationId", "hotelId",
      "rentalPropertyId", "roomKey", "updatedAt"
    ) VALUES (
      'wrong-link', 'booking-a', 'reservation-a', 'org-a', 'hotel-a',
      'property-b', 'wrong', CURRENT_TIMESTAMP
    )
  `));

  console.log("Channex per-property migration verification passed");
} finally {
  await testDb?.$disconnect();
  if (created) await adminDb.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await adminDb.$disconnect();
  await rm(resolvedTemporaryRoot, { recursive: true, force: true });
}
