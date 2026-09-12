-- Internal closed-beta operations for real hotel pilots.
-- This is additive and does not alter hotel business data.

CREATE TABLE "BetaHotelProfile" (
  "hotelId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_ENROLLED',
  "assignedAdminId" TEXT,
  "startedAt" TIMESTAMP(3),
  "lastContactAt" TIMESTAMP(3),
  "internalNote" TEXT,
  "statusReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BetaHotelProfile_pkey" PRIMARY KEY ("hotelId")
);

ALTER TABLE "BetaHotelProfile"
ADD CONSTRAINT "BetaHotelProfile_status_check"
CHECK ("status" IN ('NOT_ENROLLED', 'INVITED', 'ONBOARDING', 'ACTIVE', 'PAUSED', 'LEFT'));

ALTER TABLE "BetaHotelProfile"
ADD CONSTRAINT "BetaHotelProfile_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BetaHotelProfile"
ADD CONSTRAINT "BetaHotelProfile_assignedAdminId_fkey"
FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BetaHotelProfile_status_updatedAt_idx" ON "BetaHotelProfile"("status", "updatedAt");
CREATE INDEX "BetaHotelProfile_assignedAdminId_idx" ON "BetaHotelProfile"("assignedAdminId");
