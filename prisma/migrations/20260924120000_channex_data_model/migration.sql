-- Additive Channex transport model. Existing channel and reservation data is
-- intentionally left untouched so the integration can be rolled out per hotel.

CREATE UNIQUE INDEX "Reservation_id_hotelId_key"
  ON "Reservation"("id", "hotelId");

CREATE TABLE "ChannexProperty" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'STAGING',
  "propertyId" TEXT,
  "provisioningStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "provisioningStep" TEXT,
  "webhookId" TEXT,
  "lastProcessedRevisionId" TEXT,
  "lastProvisionedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessage" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChannexProperty_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannexProperty_environment_check"
    CHECK ("environment" IN ('STAGING', 'PRODUCTION')),
  CONSTRAINT "ChannexProperty_provisioningStatus_check"
    CHECK ("provisioningStatus" IN ('NOT_STARTED', 'IN_PROGRESS', 'READY', 'FAILED')),
  CONSTRAINT "ChannexProperty_hotelId_organizationId_fkey"
    FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ChannexProperty_hotelId_environment_key"
  ON "ChannexProperty"("hotelId", "environment");
CREATE UNIQUE INDEX "ChannexProperty_environment_propertyId_key"
  ON "ChannexProperty"("environment", "propertyId");
CREATE UNIQUE INDEX "ChannexProperty_environment_webhookId_key"
  ON "ChannexProperty"("environment", "webhookId");
CREATE UNIQUE INDEX "ChannexProperty_id_hotelId_organizationId_key"
  ON "ChannexProperty"("id", "hotelId", "organizationId");
CREATE INDEX "ChannexProperty_organizationId_hotelId_idx"
  ON "ChannexProperty"("organizationId", "hotelId");

CREATE TABLE "ChannexRoomTypeMapping" (
  "id" TEXT NOT NULL,
  "propertyRefId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "roomTypeId" TEXT NOT NULL,
  "channexRoomTypeId" TEXT,
  "provisioningStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "lastErrorCode" TEXT,
  "lastErrorMessage" VARCHAR(1000),
  "lastProvisionedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChannexRoomTypeMapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannexRoomTypeMapping_status_check"
    CHECK ("provisioningStatus" IN ('PENDING', 'PROVISIONED', 'FAILED')),
  CONSTRAINT "ChannexRoomTypeMapping_propertyRefId_hotelId_organizationI_fkey"
    FOREIGN KEY ("propertyRefId", "hotelId", "organizationId")
    REFERENCES "ChannexProperty"("id", "hotelId", "organizationId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannexRoomTypeMapping_hotelId_organizationId_fkey"
    FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannexRoomTypeMapping_roomTypeId_hotelId_fkey"
    FOREIGN KEY ("roomTypeId", "hotelId") REFERENCES "RoomType"("id", "hotelId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ChannexRoomTypeMapping_propertyRefId_roomTypeId_key"
  ON "ChannexRoomTypeMapping"("propertyRefId", "roomTypeId");
CREATE UNIQUE INDEX "ChannexRoomTypeMapping_propertyRefId_channexRoomTypeId_key"
  ON "ChannexRoomTypeMapping"("propertyRefId", "channexRoomTypeId");
CREATE INDEX "ChannexRoomTypeMapping_organizationId_hotelId_idx"
  ON "ChannexRoomTypeMapping"("organizationId", "hotelId");

CREATE TABLE "ChannexRatePlanMapping" (
  "id" TEXT NOT NULL,
  "propertyRefId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "ratePlanId" TEXT NOT NULL,
  "channexRatePlanId" TEXT,
  "provisioningStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "lastErrorCode" TEXT,
  "lastErrorMessage" VARCHAR(1000),
  "lastProvisionedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChannexRatePlanMapping_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannexRatePlanMapping_status_check"
    CHECK ("provisioningStatus" IN ('PENDING', 'PROVISIONED', 'FAILED')),
  CONSTRAINT "ChannexRatePlanMapping_propertyRefId_hotelId_organizationI_fkey"
    FOREIGN KEY ("propertyRefId", "hotelId", "organizationId")
    REFERENCES "ChannexProperty"("id", "hotelId", "organizationId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannexRatePlanMapping_hotelId_organizationId_fkey"
    FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannexRatePlanMapping_ratePlanId_hotelId_fkey"
    FOREIGN KEY ("ratePlanId", "hotelId") REFERENCES "RatePlan"("id", "hotelId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ChannexRatePlanMapping_propertyRefId_ratePlanId_key"
  ON "ChannexRatePlanMapping"("propertyRefId", "ratePlanId");
CREATE UNIQUE INDEX "ChannexRatePlanMapping_propertyRefId_channexRatePlanId_key"
  ON "ChannexRatePlanMapping"("propertyRefId", "channexRatePlanId");
CREATE INDEX "ChannexRatePlanMapping_organizationId_hotelId_idx"
  ON "ChannexRatePlanMapping"("organizationId", "hotelId");

CREATE TABLE "ChannexBooking" (
  "id" TEXT NOT NULL,
  "propertyRefId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "reservationId" TEXT,
  "channexBookingId" TEXT NOT NULL,
  "uniqueId" TEXT NOT NULL,
  "otaCode" TEXT NOT NULL,
  "otaName" TEXT,
  "otaReservationCode" TEXT,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRevisionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChannexBooking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannexBooking_propertyRefId_hotelId_organizationId_fkey"
    FOREIGN KEY ("propertyRefId", "hotelId", "organizationId")
    REFERENCES "ChannexProperty"("id", "hotelId", "organizationId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannexBooking_hotelId_organizationId_fkey"
    FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannexBooking_reservationId_hotelId_fkey"
    FOREIGN KEY ("reservationId", "hotelId") REFERENCES "Reservation"("id", "hotelId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ChannexBooking_propertyRefId_channexBookingId_key"
  ON "ChannexBooking"("propertyRefId", "channexBookingId");
CREATE UNIQUE INDEX "ChannexBooking_propertyRefId_uniqueId_key"
  ON "ChannexBooking"("propertyRefId", "uniqueId");
CREATE UNIQUE INDEX "ChannexBooking_id_hotelId_organizationId_key"
  ON "ChannexBooking"("id", "hotelId", "organizationId");
CREATE INDEX "ChannexBooking_organizationId_hotelId_idx"
  ON "ChannexBooking"("organizationId", "hotelId");
CREATE INDEX "ChannexBooking_reservationId_hotelId_idx"
  ON "ChannexBooking"("reservationId", "hotelId");
CREATE INDEX "ChannexBooking_otaCode_otaReservationCode_idx"
  ON "ChannexBooking"("otaCode", "otaReservationCode");

CREATE TABLE "ChannexBookingRevision" (
  "id" TEXT NOT NULL,
  "propertyRefId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "bookingRecordId" TEXT,
  "revisionId" TEXT NOT NULL,
  "channexBookingId" TEXT NOT NULL,
  "sourceSystemId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "safeErrorCode" TEXT,
  "safeErrorMessage" VARCHAR(1000),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStartedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChannexBookingRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannexBookingRevision_eventType_check"
    CHECK ("eventType" IN ('NEW', 'MODIFIED', 'CANCELLED')),
  CONSTRAINT "ChannexBookingRevision_processingStatus_check"
    CHECK ("processingStatus" IN ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED')),
  CONSTRAINT "ChannexBookingRevision_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "ChannexBookingRevision_propertyRefId_hotelId_organizationI_fkey"
    FOREIGN KEY ("propertyRefId", "hotelId", "organizationId")
    REFERENCES "ChannexProperty"("id", "hotelId", "organizationId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannexBookingRevision_hotelId_organizationId_fkey"
    FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannexBookingRevision_bookingRecordId_hotelId_organizatio_fkey"
    FOREIGN KEY ("bookingRecordId", "hotelId", "organizationId")
    REFERENCES "ChannexBooking"("id", "hotelId", "organizationId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ChannexBookingRevision_propertyRefId_revisionId_key"
  ON "ChannexBookingRevision"("propertyRefId", "revisionId");
CREATE UNIQUE INDEX "ChannexBookingRevision_propertyRefId_idempotencyKey_key"
  ON "ChannexBookingRevision"("propertyRefId", "idempotencyKey");
CREATE INDEX "ChannexBookingRevision_organizationId_hotelId_processingSta_idx"
  ON "ChannexBookingRevision"("organizationId", "hotelId", "processingStatus", "receivedAt");
CREATE INDEX "ChannexBookingRevision_propertyRefId_channexBookingId_idx"
  ON "ChannexBookingRevision"("propertyRefId", "channexBookingId");
CREATE INDEX "ChannexBookingRevision_bookingRecordId_hotelId_organization_idx"
  ON "ChannexBookingRevision"("bookingRecordId", "hotelId", "organizationId");
