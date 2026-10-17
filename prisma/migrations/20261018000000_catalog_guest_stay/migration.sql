-- CreateTable
CREATE TABLE "CatalogListing" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(6000) NOT NULL DEFAULT '',
    "publicLocation" VARCHAR(500) NOT NULL DEFAULT '',
    "amenities" VARCHAR(2000) NOT NULL DEFAULT '',
    "restrictions" VARCHAR(2000) NOT NULL DEFAULT '',
    "contactUrl" VARCHAR(500) NOT NULL DEFAULT '',
    "ratePlanId" TEXT,
    "photoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestStayPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "rentalPropertyId" TEXT NOT NULL,
    "identityMode" VARCHAR(24) NOT NULL DEFAULT 'NONE',
    "requireArrival" BOOLEAN NOT NULL DEFAULT false,
    "requireAgreement" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "GuestStayPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestStay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "reservationId" TEXT,
    "requestKey" VARCHAR(36) NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "firstName" VARCHAR(80) NOT NULL DEFAULT '',
    "lastName" VARCHAR(80) NOT NULL DEFAULT '',
    "phone" VARCHAR(40) NOT NULL DEFAULT '',
    "arrivalTime" VARCHAR(5) NOT NULL DEFAULT '',
    "formState" VARCHAR(16) NOT NULL DEFAULT 'EMPTY',
    "submittedRevision" VARCHAR(64),
    "reviewedRevision" VARCHAR(64),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "correctionReason" VARCHAR(1000) NOT NULL DEFAULT '',
    "identityMode" VARCHAR(24) NOT NULL DEFAULT 'NONE',
    "requireArrival" BOOLEAN NOT NULL DEFAULT false,
    "requireAgreement" BOOLEAN NOT NULL DEFAULT false,
    "originalCheckedAt" TIMESTAMP(3),
    "originalCheckedBy" TEXT,
    "agreementBundleId" TEXT,
    "accessGrantedAt" TIMESTAMP(3),
    "accessGrantedBy" TEXT,
    "tokenHash" VARCHAR(64) NOT NULL,
    "sealedToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestStay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestStayEvent" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "actorId" TEXT,
    "reason" VARCHAR(1000) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestStayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogListing_roomId_key" ON "CatalogListing"("roomId");

-- CreateIndex
CREATE INDEX "CatalogListing_hotelId_published_idx" ON "CatalogListing"("hotelId", "published");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogListing_roomId_hotelId_key" ON "CatalogListing"("roomId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestStayPolicy_rentalPropertyId_key" ON "GuestStayPolicy"("rentalPropertyId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestStayPolicy_rentalPropertyId_hotelId_organizationId_key" ON "GuestStayPolicy"("rentalPropertyId", "hotelId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestStay_reservationId_key" ON "GuestStay"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestStay_tokenHash_key" ON "GuestStay"("tokenHash");

-- CreateIndex
CREATE INDEX "GuestStay_hotelId_createdAt_idx" ON "GuestStay"("hotelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuestStay_hotelId_requestKey_key" ON "GuestStay"("hotelId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "GuestStay_reservationId_roomId_hotelId_key" ON "GuestStay"("reservationId", "roomId", "hotelId");

-- CreateIndex
CREATE INDEX "GuestStayEvent_stayId_createdAt_idx" ON "GuestStayEvent"("stayId", "createdAt");

-- AddForeignKey
ALTER TABLE "CatalogListing" ADD CONSTRAINT "CatalogListing_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogListing" ADD CONSTRAINT "CatalogListing_roomId_hotelId_fkey" FOREIGN KEY ("roomId", "hotelId") REFERENCES "Room"("id", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestStayPolicy" ADD CONSTRAINT "GuestStayPolicy_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestStayPolicy" ADD CONSTRAINT "GuestStayPolicy_rentalPropertyId_hotelId_organizationId_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId", "organizationId") REFERENCES "RentalProperty"("id", "hotelId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestStay" ADD CONSTRAINT "GuestStay_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestStay" ADD CONSTRAINT "GuestStay_roomId_hotelId_fkey" FOREIGN KEY ("roomId", "hotelId") REFERENCES "Room"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestStay" ADD CONSTRAINT "GuestStay_reservationId_roomId_hotelId_fkey" FOREIGN KEY ("reservationId", "roomId", "hotelId") REFERENCES "Reservation"("id", "roomId", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestStayEvent" ADD CONSTRAINT "GuestStayEvent_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "GuestStay"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bounded independent states and valid non-blocking stay dates.
ALTER TABLE "GuestStay" ADD CONSTRAINT "GuestStay_dates" CHECK ("checkOut" > "checkIn");
ALTER TABLE "GuestStay" ADD CONSTRAINT "GuestStay_form" CHECK ("formState" IN ('EMPTY','DRAFT','SUBMITTED','CORRECTION'));
ALTER TABLE "GuestStay" ADD CONSTRAINT "GuestStay_identity" CHECK ("identityMode" IN ('NONE','ORIGINAL_AT_ARRIVAL'));
ALTER TABLE "GuestStayPolicy" ADD CONSTRAINT "GuestStayPolicy_identity" CHECK ("identityMode" IN ('NONE','ORIGINAL_AT_ARRIVAL'));
