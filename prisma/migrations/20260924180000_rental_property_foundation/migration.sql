-- CreateEnum
CREATE TYPE "RentalPropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RentalPropertyInventoryMode" AS ENUM ('SINGLE_UNIT', 'GROUPED_UNITS');

-- CreateTable
CREATE TABLE "RentalProperty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "propertyType" TEXT,
    "status" "RentalPropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "inventoryMode" "RentalPropertyInventoryMode" NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalProperty_pkey" PRIMARY KEY ("id")
);

-- Expand existing inventory tables before the backfill.
ALTER TABLE "RoomType" ADD COLUMN "rentalPropertyId" TEXT;
ALTER TABLE "Room" ADD COLUMN "rentalPropertyId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "rentalPropertyId" TEXT;

-- Every legacy Hotel is currently one customer-facing grouped property.
INSERT INTO "RentalProperty" (
    "id",
    "organizationId",
    "hotelId",
    "internalName",
    "publicName",
    "propertyType",
    "status",
    "inventoryMode",
    "address",
    "city",
    "country",
    "timezone",
    "currency",
    "createdAt",
    "updatedAt"
)
SELECT
    'rp_' || "id",
    "orgId",
    "id",
    "name",
    "name",
    "propertyType",
    'ACTIVE'::"RentalPropertyStatus",
    'GROUPED_UNITS'::"RentalPropertyInventoryMode",
    "address",
    "city",
    "country",
    "timezone",
    "currency",
    "createdAt",
    "updatedAt"
FROM "Hotel";

-- Attach categories first, then inherit the same property through rooms and reservations.
UPDATE "RoomType" AS rt
SET "rentalPropertyId" = rp."id"
FROM "RentalProperty" AS rp
WHERE rp."hotelId" = rt."hotelId";

UPDATE "Room" AS room
SET "rentalPropertyId" = rt."rentalPropertyId"
FROM "RoomType" AS rt
WHERE rt."id" = room."roomTypeId"
  AND rt."hotelId" = room."hotelId";

UPDATE "Reservation" AS reservation
SET "rentalPropertyId" = room."rentalPropertyId"
FROM "Room" AS room
WHERE room."id" = reservation."roomId"
  AND room."hotelId" = reservation."hotelId";

-- Fail atomically instead of accepting a partial or inconsistent backfill.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Hotel" AS hotel
        LEFT JOIN "RentalProperty" AS rp ON rp."hotelId" = hotel."id"
        GROUP BY hotel."id"
        HAVING COUNT(rp."id") <> 1
    ) THEN
        RAISE EXCEPTION 'RentalProperty backfill must create exactly one property for every Hotel';
    END IF;

    IF EXISTS (SELECT 1 FROM "RoomType" WHERE "rentalPropertyId" IS NULL)
       OR EXISTS (SELECT 1 FROM "Room" WHERE "rentalPropertyId" IS NULL)
       OR EXISTS (SELECT 1 FROM "Reservation" WHERE "rentalPropertyId" IS NULL) THEN
        RAISE EXCEPTION 'RentalProperty backfill left inventory or reservations unassigned';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "Room" AS room
        JOIN "RoomType" AS rt ON rt."id" = room."roomTypeId" AND rt."hotelId" = room."hotelId"
        WHERE room."rentalPropertyId" <> rt."rentalPropertyId"
    ) OR EXISTS (
        SELECT 1
        FROM "Reservation" AS reservation
        JOIN "Room" AS room ON room."id" = reservation."roomId" AND room."hotelId" = reservation."hotelId"
        JOIN "RoomType" AS rt ON rt."id" = reservation."roomTypeId" AND rt."hotelId" = reservation."hotelId"
        WHERE reservation."rentalPropertyId" <> room."rentalPropertyId"
           OR reservation."rentalPropertyId" <> rt."rentalPropertyId"
    ) THEN
        RAISE EXCEPTION 'RentalProperty backfill produced inconsistent inventory ownership';
    END IF;
END $$;

-- Contract the new ownership fields only after the backfill assertions pass.
ALTER TABLE "RoomType" ALTER COLUMN "rentalPropertyId" SET NOT NULL;
ALTER TABLE "Room" ALTER COLUMN "rentalPropertyId" SET NOT NULL;
ALTER TABLE "Reservation" ALTER COLUMN "rentalPropertyId" SET NOT NULL;

-- Replace legacy workspace-only inventory constraints with property-aware constraints.
ALTER TABLE "Room" DROP CONSTRAINT "Room_roomTypeId_hotelId_fkey";
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_roomId_hotelId_fkey";
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_roomTypeId_hotelId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "RentalProperty_id_hotelId_key" ON "RentalProperty"("id", "hotelId");
CREATE UNIQUE INDEX "RentalProperty_id_hotelId_organizationId_key" ON "RentalProperty"("id", "hotelId", "organizationId");
CREATE INDEX "RentalProperty_organizationId_hotelId_idx" ON "RentalProperty"("organizationId", "hotelId");
CREATE UNIQUE INDEX "RoomType_id_rentalPropertyId_hotelId_key" ON "RoomType"("id", "rentalPropertyId", "hotelId");
CREATE INDEX "RoomType_rentalPropertyId_hotelId_idx" ON "RoomType"("rentalPropertyId", "hotelId");
CREATE UNIQUE INDEX "Room_id_rentalPropertyId_hotelId_key" ON "Room"("id", "rentalPropertyId", "hotelId");
CREATE INDEX "Room_rentalPropertyId_hotelId_idx" ON "Room"("rentalPropertyId", "hotelId");
CREATE INDEX "Reservation_rentalPropertyId_hotelId_idx" ON "Reservation"("rentalPropertyId", "hotelId");

-- AddForeignKey
ALTER TABLE "RentalProperty" ADD CONSTRAINT "RentalProperty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalProperty" ADD CONSTRAINT "RentalProperty_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId") REFERENCES "RentalProperty"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId") REFERENCES "RentalProperty"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("roomTypeId", "rentalPropertyId", "hotelId") REFERENCES "RoomType"("id", "rentalPropertyId", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId") REFERENCES "RentalProperty"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("roomId", "rentalPropertyId", "hotelId") REFERENCES "Room"("id", "rentalPropertyId", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomTypeId_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("roomTypeId", "rentalPropertyId", "hotelId") REFERENCES "RoomType"("id", "rentalPropertyId", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
