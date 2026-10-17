-- CreateTable
CREATE TABLE "KaspiPaymentMethod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "rentalPropertyId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "recipient" VARCHAR(160) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KaspiPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestPaymentRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "rentalPropertyId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "revision" VARCHAR(64) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "recipient" VARCHAR(160) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestPaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KaspiPaymentMethod_rentalPropertyId_key" ON "KaspiPaymentMethod"("rentalPropertyId");

-- CreateIndex
CREATE INDEX "KaspiPaymentMethod_organizationId_hotelId_idx" ON "KaspiPaymentMethod"("organizationId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "KaspiPaymentMethod_id_rentalPropertyId_hotelId_key" ON "KaspiPaymentMethod"("id", "rentalPropertyId", "hotelId");

-- CreateIndex
CREATE INDEX "GuestPaymentRequest_reservationId_hotelId_createdAt_idx" ON "GuestPaymentRequest"("reservationId", "hotelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GuestPaymentRequest_hotelId_userId_digest_key" ON "GuestPaymentRequest"("hotelId", "userId", "digest");

-- AddForeignKey
ALTER TABLE "KaspiPaymentMethod" ADD CONSTRAINT "KaspiPaymentMethod_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KaspiPaymentMethod" ADD CONSTRAINT "KaspiPaymentMethod_rentalPropertyId_hotelId_organizationId_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId", "organizationId") REFERENCES "RentalProperty"("id", "hotelId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPaymentRequest" ADD CONSTRAINT "GuestPaymentRequest_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPaymentRequest" ADD CONSTRAINT "GuestPaymentRequest_rentalPropertyId_hotelId_organizationI_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId", "organizationId") REFERENCES "RentalProperty"("id", "hotelId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPaymentRequest" ADD CONSTRAINT "GuestPaymentRequest_reservationId_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("reservationId", "rentalPropertyId", "hotelId") REFERENCES "Reservation"("id", "rentalPropertyId", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPaymentRequest" ADD CONSTRAINT "GuestPaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Defensive invariants independent of the application. These tables are additive.
ALTER TABLE "KaspiPaymentMethod" ADD CONSTRAINT "KaspiPaymentMethod_version_positive" CHECK ("version" > 0);
ALTER TABLE "GuestPaymentRequest" ADD CONSTRAINT "GuestPaymentRequest_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "GuestPaymentRequest" ADD CONSTRAINT "GuestPaymentRequest_currency_kzt" CHECK ("currency" = 'KZT');
ALTER TABLE "GuestPaymentRequest" ADD CONSTRAINT "GuestPaymentRequest_hash_shape" CHECK ("digest" ~ '^[0-9a-f]{64}$' AND "revision" ~ '^[0-9a-f]{64}$');
