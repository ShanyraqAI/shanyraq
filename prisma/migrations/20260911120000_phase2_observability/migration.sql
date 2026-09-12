-- Phase 2: platform administration and privacy-minimal beta analytics.
-- Additive only: no existing data is rewritten or removed.

ALTER TABLE "User" ADD COLUMN "platformRole" TEXT;

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "hotelId" TEXT,
    "sessionId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadataJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User"
ADD CONSTRAINT "User_platformRole_check"
CHECK ("platformRole" IS NULL OR "platformRole" = 'SUPER_ADMIN');

ALTER TABLE "AnalyticsEvent"
ADD CONSTRAINT "AnalyticsEvent_eventType_check"
CHECK ("eventType" IN (
    'signup_completed',
    'hotel_created',
    'room_created',
    'room_updated',
    'reservation_created',
    'reservation_updated',
    'reservation_cancelled',
    'calendar_opened',
    'guest_created',
    'rate_updated',
    'feedback_submitted',
    'bug_reported',
    'login'
));

CREATE INDEX "AnalyticsEvent_eventType_occurredAt_idx" ON "AnalyticsEvent"("eventType", "occurredAt");
CREATE INDEX "AnalyticsEvent_userId_occurredAt_idx" ON "AnalyticsEvent"("userId", "occurredAt");
CREATE INDEX "AnalyticsEvent_organizationId_occurredAt_idx" ON "AnalyticsEvent"("organizationId", "occurredAt");
CREATE INDEX "AnalyticsEvent_hotelId_occurredAt_idx" ON "AnalyticsEvent"("hotelId", "occurredAt");

ALTER TABLE "AnalyticsEvent"
ADD CONSTRAINT "AnalyticsEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent"
ADD CONSTRAINT "AnalyticsEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnalyticsEvent"
ADD CONSTRAINT "AnalyticsEvent_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
