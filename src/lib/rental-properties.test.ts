import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import test from "node:test";

const migrationPath = new URL("../../prisma/migrations/20260924180000_rental_property_foundation/migration.sql", import.meta.url);

test("RentalProperty migration contains an atomic legacy backfill and required ownership constraints", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /INSERT INTO "RentalProperty"[\s\S]+FROM "Hotel";/);
  assert.match(sql, /HAVING COUNT\(rp\."id"\) <> 1/);
  assert.match(sql, /ALTER TABLE "RoomType" ALTER COLUMN "rentalPropertyId" SET NOT NULL/);
  assert.match(sql, /ALTER TABLE "Room" ALTER COLUMN "rentalPropertyId" SET NOT NULL/);
  assert.match(sql, /ALTER TABLE "Reservation" ALTER COLUMN "rentalPropertyId" SET NOT NULL/);
  assert.match(sql, /Room_roomTypeId_rentalPropertyId_hotelId_fkey/);
  assert.match(sql, /Reservation_roomId_rentalPropertyId_hotelId_fkey/);
  assert.match(sql, /Reservation_roomTypeId_rentalPropertyId_hotelId_fkey/);
});

test("PostgreSQL enforces RentalProperty organization, workspace and inventory ownership", { skip: process.env.RENTAL_PROPERTY_DB_TESTS !== "true" }, async () => {
  const { db } = await import("@/lib/db");
  const { createDefaultRentalProperty } = await import("@/lib/rental-properties");
  const prefix = `rental-property-test-${randomUUID()}`;
  const orgAId = `${prefix}-org-a`;
  const orgBId = `${prefix}-org-b`;

  try {
    await db.organization.createMany({
      data: [
        { id: orgAId, name: "Rental property test A" },
        { id: orgBId, name: "Rental property test B" },
      ],
    });
    const hotelA = await db.hotel.create({ data: { id: `${prefix}-hotel-a`, orgId: orgAId, slug: `${prefix}-a`, name: "Workspace A" } });
    const hotelB = await db.hotel.create({ data: { id: `${prefix}-hotel-b`, orgId: orgAId, slug: `${prefix}-b`, name: "Workspace B" } });
    const hotelC = await db.hotel.create({ data: { id: `${prefix}-hotel-c`, orgId: orgBId, slug: `${prefix}-c`, name: "Workspace C" } });
    const propertyA = await createDefaultRentalProperty(db, hotelA);
    const propertyB = await createDefaultRentalProperty(db, hotelB);
    await createDefaultRentalProperty(db, hotelC);

    assert.equal(await db.rentalProperty.count({ where: { hotelId: hotelA.id } }), 1);
    await assert.rejects(db.rentalProperty.create({
      data: { organizationId: orgBId, hotelId: hotelA.id, internalName: "Wrong tenant", publicName: "Wrong tenant", inventoryMode: "GROUPED_UNITS" },
    }));
    await assert.rejects(db.roomType.create({
      data: { hotelId: hotelB.id, rentalPropertyId: propertyA.id, name: "Wrong workspace", capacity: 2, basePrice: 1 },
    }));

    const roomType = await db.roomType.create({
      data: { hotelId: hotelA.id, rentalPropertyId: propertyA.id, name: "Standard", capacity: 2, basePrice: 20_000 },
    });
    const room = await db.room.create({
      data: { hotelId: hotelA.id, rentalPropertyId: propertyA.id, roomTypeId: roomType.id, number: "101" },
    });
    const guest = await db.guest.create({ data: { hotelId: hotelA.id, fullName: "Test Guest" } });
    const reservation = await db.reservation.create({
      data: {
        hotelId: hotelA.id,
        rentalPropertyId: propertyA.id,
        guestId: guest.id,
        roomId: room.id,
        roomTypeId: roomType.id,
        sourceChannel: "direct",
        checkIn: new Date("2035-01-01T00:00:00.000Z"),
        checkOut: new Date("2035-01-02T00:00:00.000Z"),
        totalAmount: 20_000,
      },
    });

    assert.equal(roomType.rentalPropertyId, propertyA.id);
    assert.equal(room.rentalPropertyId, propertyA.id);
    assert.equal(reservation.rentalPropertyId, propertyA.id);

    const secondPropertyInA = await db.rentalProperty.create({
      data: { organizationId: orgAId, hotelId: hotelA.id, internalName: "Second property", publicName: "Second property", inventoryMode: "SINGLE_UNIT" },
    });
    await assert.rejects(db.room.create({
      data: { hotelId: hotelA.id, rentalPropertyId: secondPropertyInA.id, roomTypeId: roomType.id, number: "102" },
    }));
    await assert.rejects(db.reservation.create({
      data: {
        hotelId: hotelA.id,
        rentalPropertyId: secondPropertyInA.id,
        guestId: guest.id,
        roomId: room.id,
        roomTypeId: roomType.id,
        sourceChannel: "direct",
        checkIn: new Date("2035-02-01T00:00:00.000Z"),
        checkOut: new Date("2035-02-02T00:00:00.000Z"),
        totalAmount: 20_000,
      },
    }));
    await assert.rejects(db.room.create({
      data: { hotelId: hotelA.id, rentalPropertyId: propertyB.id, roomTypeId: roomType.id, number: "103" },
    }));
  } finally {
    await db.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    await db.$disconnect();
  }
});
