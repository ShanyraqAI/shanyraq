-- Human-readable entity numbers are scoped to a hotel. Internal cuid keys are
-- intentionally unchanged because they remain the secure relational IDs.
ALTER TABLE "Guest" ADD COLUMN "sequenceNumber" INTEGER;
ALTER TABLE "Reservation" ADD COLUMN "sequenceNumber" INTEGER;
ALTER TABLE "RatePlan" ADD COLUMN "sequenceNumber" INTEGER;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "hotelId" ORDER BY "id")::INTEGER AS number
  FROM "Guest"
)
UPDATE "Guest" AS entity
SET "sequenceNumber" = ranked.number
FROM ranked
WHERE entity."id" = ranked."id";

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "hotelId" ORDER BY "createdAt", "id")::INTEGER AS number
  FROM "Reservation"
)
UPDATE "Reservation" AS entity
SET "sequenceNumber" = ranked.number
FROM ranked
WHERE entity."id" = ranked."id";

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "hotelId" ORDER BY "id")::INTEGER AS number
  FROM "RatePlan"
)
UPDATE "RatePlan" AS entity
SET "sequenceNumber" = ranked.number
FROM ranked
WHERE entity."id" = ranked."id";

CREATE UNIQUE INDEX "Guest_hotelId_sequenceNumber_key" ON "Guest"("hotelId", "sequenceNumber");
CREATE UNIQUE INDEX "Reservation_hotelId_sequenceNumber_key" ON "Reservation"("hotelId", "sequenceNumber");
CREATE UNIQUE INDEX "RatePlan_hotelId_sequenceNumber_key" ON "RatePlan"("hotelId", "sequenceNumber");

CREATE TABLE "HotelEntitySequence" (
  "hotelId" TEXT NOT NULL,
  "nextGuestNumber" INTEGER NOT NULL DEFAULT 1,
  "nextReservationNumber" INTEGER NOT NULL DEFAULT 1,
  "nextRatePlanNumber" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "HotelEntitySequence_pkey" PRIMARY KEY ("hotelId"),
  CONSTRAINT "HotelEntitySequence_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "HotelEntitySequence" ("hotelId", "nextGuestNumber", "nextReservationNumber", "nextRatePlanNumber")
SELECT
  hotel."id",
  COALESCE((SELECT MAX(guest."sequenceNumber") + 1 FROM "Guest" AS guest WHERE guest."hotelId" = hotel."id"), 1),
  COALESCE((SELECT MAX(reservation."sequenceNumber") + 1 FROM "Reservation" AS reservation WHERE reservation."hotelId" = hotel."id"), 1),
  COALESCE((SELECT MAX(plan."sequenceNumber") + 1 FROM "RatePlan" AS plan WHERE plan."hotelId" = hotel."id"), 1)
FROM "Hotel" AS hotel;

CREATE FUNCTION assign_hotel_entity_sequence() RETURNS trigger AS $$
DECLARE
  assigned_number INTEGER;
BEGIN
  IF NEW."sequenceNumber" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO "HotelEntitySequence" ("hotelId")
  VALUES (NEW."hotelId")
  ON CONFLICT ("hotelId") DO NOTHING;

  IF TG_TABLE_NAME = 'Guest' THEN
    UPDATE "HotelEntitySequence"
    SET "nextGuestNumber" = "nextGuestNumber" + 1
    WHERE "hotelId" = NEW."hotelId"
    RETURNING "nextGuestNumber" - 1 INTO assigned_number;
  ELSIF TG_TABLE_NAME = 'Reservation' THEN
    UPDATE "HotelEntitySequence"
    SET "nextReservationNumber" = "nextReservationNumber" + 1
    WHERE "hotelId" = NEW."hotelId"
    RETURNING "nextReservationNumber" - 1 INTO assigned_number;
  ELSIF TG_TABLE_NAME = 'RatePlan' THEN
    UPDATE "HotelEntitySequence"
    SET "nextRatePlanNumber" = "nextRatePlanNumber" + 1
    WHERE "hotelId" = NEW."hotelId"
    RETURNING "nextRatePlanNumber" - 1 INTO assigned_number;
  ELSE
    RAISE EXCEPTION 'Unsupported table for hotel entity sequence: %', TG_TABLE_NAME;
  END IF;

  NEW."sequenceNumber" := assigned_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Guest_assign_sequence_number"
BEFORE INSERT ON "Guest"
FOR EACH ROW EXECUTE FUNCTION assign_hotel_entity_sequence();

CREATE TRIGGER "Reservation_assign_sequence_number"
BEFORE INSERT ON "Reservation"
FOR EACH ROW EXECUTE FUNCTION assign_hotel_entity_sequence();

CREATE TRIGGER "RatePlan_assign_sequence_number"
BEFORE INSERT ON "RatePlan"
FOR EACH ROW EXECUTE FUNCTION assign_hotel_entity_sequence();
