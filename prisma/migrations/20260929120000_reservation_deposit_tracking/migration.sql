ALTER TABLE "Reservation"
  ADD COLUMN "depositAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "depositCollectedAt" TIMESTAMP(3),
  ADD COLUMN "depositReturnedAt" TIMESTAMP(3);
