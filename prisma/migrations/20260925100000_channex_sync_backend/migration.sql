ALTER TABLE "ChannexProperty"
  ADD COLUMN "lastFullSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncStatus" TEXT,
  ADD COLUMN "lastBookingPollAt" TIMESTAMP(3);

CREATE TABLE "ChannexSyncJob" (
  "id" TEXT NOT NULL,
  "propertyRefId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "rentalPropertyId" TEXT NOT NULL,
  "deduplicationKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "availabilityRequested" BOOLEAN NOT NULL DEFAULT false,
  "restrictionsRequested" BOOLEAN NOT NULL DEFAULT false,
  "fullSyncRequested" BOOLEAN NOT NULL DEFAULT false,
  "roomTypeIds" JSONB NOT NULL,
  "ratePlanIds" JSONB NOT NULL,
  "dateFrom" TIMESTAMP(3) NOT NULL,
  "dateTo" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 6,
  "rerunRequested" BOOLEAN NOT NULL DEFAULT false,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "finishedAt" TIMESTAMP(3),
  "lastTaskIds" JSONB,
  "lastErrorCode" TEXT,
  "lastErrorMessage" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannexSyncJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannexSyncJob_status_check" CHECK ("status" IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT "ChannexSyncJob_dates_check" CHECK ("dateTo" >= "dateFrom"),
  CONSTRAINT "ChannexSyncJob_attempts_check" CHECK ("attempts" >= 0 AND "maxAttempts" > 0)
);

CREATE TABLE "ChannexBookingReservation" (
  "id" TEXT NOT NULL,
  "bookingRecordId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "rentalPropertyId" TEXT NOT NULL,
  "roomKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannexBookingReservation_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ChannexBookingReservation" (
  "id", "bookingRecordId", "reservationId", "organizationId", "hotelId",
  "rentalPropertyId", "roomKey", "createdAt", "updatedAt"
)
SELECT
  'channex_link_' || md5("id" || ':' || "reservationId"),
  "id", "reservationId", "organizationId", "hotelId", "rentalPropertyId",
  'legacy-primary', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ChannexBooking"
WHERE "reservationId" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "ChannexSyncJob_deduplicationKey_key" ON "ChannexSyncJob"("deduplicationKey");
CREATE INDEX "ChannexSyncJob_status_availableAt_idx" ON "ChannexSyncJob"("status", "availableAt");
CREATE INDEX "ChannexSyncJob_propertyRefId_createdAt_idx" ON "ChannexSyncJob"("propertyRefId", "createdAt");
CREATE INDEX "ChannexSyncJob_organizationId_hotelId_idx" ON "ChannexSyncJob"("organizationId", "hotelId");

CREATE UNIQUE INDEX "ChannexBookingReservation_bookingRecordId_roomKey_key"
  ON "ChannexBookingReservation"("bookingRecordId", "roomKey");
CREATE UNIQUE INDEX "ChannexBookingReservation_bookingRecordId_reservationId_key"
  ON "ChannexBookingReservation"("bookingRecordId", "reservationId");
CREATE INDEX "ChannexBookingReservation_reservationId_hotelId_idx"
  ON "ChannexBookingReservation"("reservationId", "hotelId");
CREATE INDEX "ChannexBookingReservation_organizationId_hotelId_idx"
  ON "ChannexBookingReservation"("organizationId", "hotelId");

ALTER TABLE "ChannexSyncJob"
  ADD CONSTRAINT "ChannexSyncJob_propertyRefId_rentalPropertyId_hotelId_organizationId_fkey"
  FOREIGN KEY ("propertyRefId", "rentalPropertyId", "hotelId", "organizationId")
  REFERENCES "ChannexProperty"("id", "rentalPropertyId", "hotelId", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannexSyncJob"
  ADD CONSTRAINT "ChannexSyncJob_hotelId_organizationId_fkey"
  FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannexSyncJob"
  ADD CONSTRAINT "ChannexSyncJob_rentalPropertyId_hotelId_organizationId_fkey"
  FOREIGN KEY ("rentalPropertyId", "hotelId", "organizationId")
  REFERENCES "RentalProperty"("id", "hotelId", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannexBookingReservation"
  ADD CONSTRAINT "ChannexBookingReservation_bookingRecordId_rentalPropertyId_hotelId_organizationId_fkey"
  FOREIGN KEY ("bookingRecordId", "rentalPropertyId", "hotelId", "organizationId")
  REFERENCES "ChannexBooking"("id", "rentalPropertyId", "hotelId", "organizationId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannexBookingReservation"
  ADD CONSTRAINT "ChannexBookingReservation_reservationId_rentalPropertyId_hotelId_fkey"
  FOREIGN KEY ("reservationId", "rentalPropertyId", "hotelId")
  REFERENCES "Reservation"("id", "rentalPropertyId", "hotelId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChannexBookingReservation"
  ADD CONSTRAINT "ChannexBookingReservation_hotelId_organizationId_fkey"
  FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChannexProperty"
  ADD CONSTRAINT "ChannexProperty_lastSyncStatus_check"
  CHECK ("lastSyncStatus" IS NULL OR "lastSyncStatus" IN ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED'));
