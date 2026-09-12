-- Phase 3: persistent setup/tour progress and the closed-beta support inbox.
-- Additive only: no existing data is rewritten or removed.

CREATE TABLE "ProductExperience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "setupStep" INTEGER NOT NULL DEFAULT 1,
    "setupCompletedAt" TIMESTAMP(3),
    "tourCompletedAt" TIMESTAMP(3),
    "tourSkippedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductExperience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductExperience"
ADD CONSTRAINT "ProductExperience_setupStep_check"
CHECK ("setupStep" BETWEEN 1 AND 3);

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_category_check"
CHECK ("category" IN ('QUESTION', 'PROBLEM', 'SUGGESTION'));

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_status_check"
CHECK ("status" IN ('OPEN', 'REVIEWING', 'RESOLVED'));

CREATE UNIQUE INDEX "ProductExperience_userId_hotelId_key" ON "ProductExperience"("userId", "hotelId");
CREATE INDEX "ProductExperience_hotelId_idx" ON "ProductExperience"("hotelId");
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
CREATE INDEX "SupportRequest_hotelId_createdAt_idx" ON "SupportRequest"("hotelId", "createdAt");

ALTER TABLE "ProductExperience"
ADD CONSTRAINT "ProductExperience_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductExperience"
ADD CONSTRAINT "ProductExperience_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
