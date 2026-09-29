ALTER TABLE "Reservation"
  ADD COLUMN "channelBookingAmount" DECIMAL(14,2),
  ADD COLUMN "otaCommissionAmount" DECIMAL(14,2),
  ADD COLUMN "otaCommissionSource" TEXT,
  ADD COLUMN "commissionRateSnapshot" DECIMAL(7,4),
  ADD COLUMN "commissionFixedSnapshot" DECIMAL(14,2),
  ADD COLUMN "paymentCollect" TEXT,
  ADD COLUMN "paymentType" TEXT,
  ADD COLUMN "financialServices" JSONB,
  ADD COLUMN "financialComponentsSource" TEXT;

CREATE TABLE "ChannelCommissionSetting" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "sourceChannel" TEXT NOT NULL,
  "ratePercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
  "fixedFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'KZT',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelCommissionSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelCommissionSetting_hotelId_sourceChannel_key" ON "ChannelCommissionSetting"("hotelId", "sourceChannel");
CREATE INDEX "ChannelCommissionSetting_hotelId_idx" ON "ChannelCommissionSetting"("hotelId");
ALTER TABLE "ChannelCommissionSetting" ADD CONSTRAINT "ChannelCommissionSetting_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinancialOperation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "rentalPropertyId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "method" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "externalKey" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialOperation_hotelId_externalKey_key" ON "FinancialOperation"("hotelId", "externalKey");
CREATE INDEX "FinancialOperation_organizationId_hotelId_occurredAt_idx" ON "FinancialOperation"("organizationId", "hotelId", "occurredAt");
CREATE INDEX "FinancialOperation_reservationId_hotelId_type_status_idx" ON "FinancialOperation"("reservationId", "hotelId", "type", "status");
ALTER TABLE "FinancialOperation" ADD CONSTRAINT "FinancialOperation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialOperation" ADD CONSTRAINT "FinancialOperation_reservationId_rentalPropertyId_hotelId_fkey" FOREIGN KEY ("reservationId", "rentalPropertyId", "hotelId") REFERENCES "Reservation"("id", "rentalPropertyId", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialOperation" ADD CONSTRAINT "FinancialOperation_rentalPropertyId_hotelId_organizationId_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId", "organizationId") REFERENCES "RentalProperty"("id", "hotelId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
