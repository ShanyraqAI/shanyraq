-- Scope rate plans and every Channex transport record to a RentalProperty.
ALTER TABLE "RatePlan" ADD COLUMN "rentalPropertyId" TEXT;
ALTER TABLE "ChannexProperty" ADD COLUMN "rentalPropertyId" TEXT;
ALTER TABLE "ChannexRoomTypeMapping" ADD COLUMN "rentalPropertyId" TEXT;
ALTER TABLE "ChannexRatePlanMapping" ADD COLUMN "rentalPropertyId" TEXT;
ALTER TABLE "ChannexBooking" ADD COLUMN "rentalPropertyId" TEXT;
ALTER TABLE "ChannexBookingRevision" ADD COLUMN "rentalPropertyId" TEXT;

UPDATE "RatePlan" AS rate_plan
SET "rentalPropertyId" = room_type."rentalPropertyId"
FROM "RoomType" AS room_type
WHERE room_type."id" = rate_plan."roomTypeId";

-- An existing Channex property may only contain inventory from one RentalProperty.
DO $$
BEGIN
  IF EXISTS (
    SELECT ownership."propertyRefId"
    FROM (
      SELECT mapping."propertyRefId", room_type."rentalPropertyId"
      FROM "ChannexRoomTypeMapping" AS mapping
      JOIN "RoomType" AS room_type ON room_type."id" = mapping."roomTypeId"
      UNION ALL
      SELECT mapping."propertyRefId", rate_plan."rentalPropertyId"
      FROM "ChannexRatePlanMapping" AS mapping
      JOIN "RatePlan" AS rate_plan ON rate_plan."id" = mapping."ratePlanId"
      UNION ALL
      SELECT booking."propertyRefId", reservation."rentalPropertyId"
      FROM "ChannexBooking" AS booking
      JOIN "Reservation" AS reservation ON reservation."id" = booking."reservationId"
    ) AS ownership
    GROUP BY ownership."propertyRefId"
    HAVING COUNT(DISTINCT ownership."rentalPropertyId") > 1
  ) THEN
    RAISE EXCEPTION 'An existing ChannexProperty contains records from multiple RentalProperty rows';
  END IF;
END $$;

UPDATE "ChannexProperty" AS property
SET "rentalPropertyId" = COALESCE(
  (
    SELECT room_type."rentalPropertyId"
    FROM "ChannexRoomTypeMapping" AS mapping
    JOIN "RoomType" AS room_type ON room_type."id" = mapping."roomTypeId"
    WHERE mapping."propertyRefId" = property."id"
    LIMIT 1
  ),
  (
    SELECT rate_plan."rentalPropertyId"
    FROM "ChannexRatePlanMapping" AS mapping
    JOIN "RatePlan" AS rate_plan ON rate_plan."id" = mapping."ratePlanId"
    WHERE mapping."propertyRefId" = property."id"
    LIMIT 1
  ),
  (
    SELECT reservation."rentalPropertyId"
    FROM "ChannexBooking" AS booking
    JOIN "Reservation" AS reservation ON reservation."id" = booking."reservationId"
    WHERE booking."propertyRefId" = property."id"
    LIMIT 1
  ),
  (
    SELECT rental_property."id"
    FROM "RentalProperty" AS rental_property
    WHERE rental_property."hotelId" = property."hotelId"
      AND rental_property."organizationId" = property."organizationId"
    ORDER BY rental_property."createdAt", rental_property."id"
    LIMIT 1
  )
);

UPDATE "ChannexRoomTypeMapping" AS mapping
SET "rentalPropertyId" = property."rentalPropertyId"
FROM "ChannexProperty" AS property
WHERE property."id" = mapping."propertyRefId";

UPDATE "ChannexRatePlanMapping" AS mapping
SET "rentalPropertyId" = property."rentalPropertyId"
FROM "ChannexProperty" AS property
WHERE property."id" = mapping."propertyRefId";

UPDATE "ChannexBooking" AS booking
SET "rentalPropertyId" = property."rentalPropertyId"
FROM "ChannexProperty" AS property
WHERE property."id" = booking."propertyRefId";

UPDATE "ChannexBookingRevision" AS revision
SET "rentalPropertyId" = property."rentalPropertyId"
FROM "ChannexProperty" AS property
WHERE property."id" = revision."propertyRefId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "RatePlan" WHERE "rentalPropertyId" IS NULL)
     OR EXISTS (SELECT 1 FROM "ChannexProperty" WHERE "rentalPropertyId" IS NULL)
     OR EXISTS (SELECT 1 FROM "ChannexRoomTypeMapping" WHERE "rentalPropertyId" IS NULL)
     OR EXISTS (SELECT 1 FROM "ChannexRatePlanMapping" WHERE "rentalPropertyId" IS NULL)
     OR EXISTS (SELECT 1 FROM "ChannexBooking" WHERE "rentalPropertyId" IS NULL)
     OR EXISTS (SELECT 1 FROM "ChannexBookingRevision" WHERE "rentalPropertyId" IS NULL) THEN
    RAISE EXCEPTION 'RentalProperty backfill left rate or Channex records unassigned';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "RatePlan" AS rate_plan
    JOIN "RoomType" AS room_type ON room_type."id" = rate_plan."roomTypeId"
    WHERE rate_plan."rentalPropertyId" <> room_type."rentalPropertyId"
       OR rate_plan."hotelId" <> room_type."hotelId"
  ) OR EXISTS (
    SELECT 1 FROM "ChannexRoomTypeMapping" AS mapping
    JOIN "RoomType" AS room_type ON room_type."id" = mapping."roomTypeId"
    WHERE mapping."rentalPropertyId" <> room_type."rentalPropertyId"
       OR mapping."hotelId" <> room_type."hotelId"
  ) OR EXISTS (
    SELECT 1 FROM "ChannexRatePlanMapping" AS mapping
    JOIN "RatePlan" AS rate_plan ON rate_plan."id" = mapping."ratePlanId"
    WHERE mapping."rentalPropertyId" <> rate_plan."rentalPropertyId"
       OR mapping."hotelId" <> rate_plan."hotelId"
  ) OR EXISTS (
    SELECT 1 FROM "ChannexBooking" AS booking
    JOIN "Reservation" AS reservation ON reservation."id" = booking."reservationId"
    WHERE booking."rentalPropertyId" <> reservation."rentalPropertyId"
       OR booking."hotelId" <> reservation."hotelId"
  ) THEN
    RAISE EXCEPTION 'Rate or Channex ownership is inconsistent with RentalProperty';
  END IF;
END $$;

ALTER TABLE "RatePlan" ALTER COLUMN "rentalPropertyId" SET NOT NULL;
ALTER TABLE "ChannexProperty" ALTER COLUMN "rentalPropertyId" SET NOT NULL;
ALTER TABLE "ChannexRoomTypeMapping" ALTER COLUMN "rentalPropertyId" SET NOT NULL;
ALTER TABLE "ChannexRatePlanMapping" ALTER COLUMN "rentalPropertyId" SET NOT NULL;
ALTER TABLE "ChannexBooking" ALTER COLUMN "rentalPropertyId" SET NOT NULL;
ALTER TABLE "ChannexBookingRevision" ALTER COLUMN "rentalPropertyId" SET NOT NULL;

-- Replace workspace-only foreign keys with property-aware keys.
ALTER TABLE "RatePlan" DROP CONSTRAINT "RatePlan_roomTypeId_fkey";
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_ratePlanId_hotelId_fkey";
ALTER TABLE "ChannexRoomTypeMapping" DROP CONSTRAINT "ChannexRoomTypeMapping_propertyRefId_hotelId_organizationI_fkey";
ALTER TABLE "ChannexRoomTypeMapping" DROP CONSTRAINT "ChannexRoomTypeMapping_roomTypeId_hotelId_fkey";
ALTER TABLE "ChannexRatePlanMapping" DROP CONSTRAINT "ChannexRatePlanMapping_propertyRefId_hotelId_organizationI_fkey";
ALTER TABLE "ChannexRatePlanMapping" DROP CONSTRAINT "ChannexRatePlanMapping_ratePlanId_hotelId_fkey";
ALTER TABLE "ChannexBooking" DROP CONSTRAINT "ChannexBooking_propertyRefId_hotelId_organizationId_fkey";
ALTER TABLE "ChannexBooking" DROP CONSTRAINT "ChannexBooking_reservationId_hotelId_fkey";
ALTER TABLE "ChannexBookingRevision" DROP CONSTRAINT "ChannexBookingRevision_propertyRefId_hotelId_organizationI_fkey";
ALTER TABLE "ChannexBookingRevision" DROP CONSTRAINT "ChannexBookingRevision_bookingRecordId_hotelId_organizatio_fkey";

DROP INDEX "ChannexProperty_hotelId_environment_key";
DROP INDEX "ChannexProperty_id_hotelId_organizationId_key";
DROP INDEX "ChannexBooking_id_hotelId_organizationId_key";

CREATE UNIQUE INDEX "Reservation_id_rentalPropertyId_hotelId_key" ON "Reservation"("id", "rentalPropertyId", "hotelId");
CREATE UNIQUE INDEX "RatePlan_id_rentalPropertyId_hotelId_key" ON "RatePlan"("id", "rentalPropertyId", "hotelId");
CREATE INDEX "RatePlan_rentalPropertyId_hotelId_idx" ON "RatePlan"("rentalPropertyId", "hotelId");
CREATE UNIQUE INDEX "ChannexProperty_rentalPropertyId_environment_key" ON "ChannexProperty"("rentalPropertyId", "environment");
CREATE UNIQUE INDEX "ChannexProperty_id_rentalPropertyId_hotelId_organizationId_key" ON "ChannexProperty"("id", "rentalPropertyId", "hotelId", "organizationId");
CREATE UNIQUE INDEX "ChannexBooking_id_rentalPropertyId_hotelId_organizationId_key" ON "ChannexBooking"("id", "rentalPropertyId", "hotelId", "organizationId");

ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId") REFERENCES "RentalProperty"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_roomTypeId_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("roomTypeId", "rentalPropertyId", "hotelId") REFERENCES "RoomType"("id", "rentalPropertyId", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ratePlanId_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("ratePlanId", "rentalPropertyId", "hotelId") REFERENCES "RatePlan"("id", "rentalPropertyId", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannexProperty" ADD CONSTRAINT "ChannexProperty_rentalPropertyId_hotelId_organizationId_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId", "organizationId") REFERENCES "RentalProperty"("id", "hotelId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannexRoomTypeMapping" ADD CONSTRAINT "ChannexRoomTypeMapping_property_scope_fkey" FOREIGN KEY ("propertyRefId", "rentalPropertyId", "hotelId", "organizationId") REFERENCES "ChannexProperty"("id", "rentalPropertyId", "hotelId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannexRoomTypeMapping" ADD CONSTRAINT "ChannexRoomTypeMapping_room_type_scope_fkey" FOREIGN KEY ("roomTypeId", "rentalPropertyId", "hotelId") REFERENCES "RoomType"("id", "rentalPropertyId", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannexRatePlanMapping" ADD CONSTRAINT "ChannexRatePlanMapping_property_scope_fkey" FOREIGN KEY ("propertyRefId", "rentalPropertyId", "hotelId", "organizationId") REFERENCES "ChannexProperty"("id", "rentalPropertyId", "hotelId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannexRatePlanMapping" ADD CONSTRAINT "ChannexRatePlanMapping_rate_plan_scope_fkey" FOREIGN KEY ("ratePlanId", "rentalPropertyId", "hotelId") REFERENCES "RatePlan"("id", "rentalPropertyId", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannexBooking" ADD CONSTRAINT "ChannexBooking_property_scope_fkey" FOREIGN KEY ("propertyRefId", "rentalPropertyId", "hotelId", "organizationId") REFERENCES "ChannexProperty"("id", "rentalPropertyId", "hotelId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannexBooking" ADD CONSTRAINT "ChannexBooking_reservation_scope_fkey" FOREIGN KEY ("reservationId", "rentalPropertyId", "hotelId") REFERENCES "Reservation"("id", "rentalPropertyId", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannexBookingRevision" ADD CONSTRAINT "ChannexBookingRevision_property_scope_fkey" FOREIGN KEY ("propertyRefId", "rentalPropertyId", "hotelId", "organizationId") REFERENCES "ChannexProperty"("id", "rentalPropertyId", "hotelId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannexBookingRevision" ADD CONSTRAINT "ChannexBookingRevision_booking_scope_fkey" FOREIGN KEY ("bookingRecordId", "rentalPropertyId", "hotelId", "organizationId") REFERENCES "ChannexBooking"("id", "rentalPropertyId", "hotelId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
