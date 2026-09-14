-- Personal notification delivery preferences and immutable before/after audit snapshots.
ALTER TABLE "Membership"
ADD COLUMN "newReservationEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "dailyDigestEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "digestHour" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "Notification"
ADD COLUMN "recipientUserId" TEXT,
ADD COLUMN "href" TEXT,
ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "emailSentAt" TIMESTAMP(3);

ALTER TABLE "AuditLog"
ADD COLUMN "oldValueJson" TEXT,
ADD COLUMN "newValueJson" TEXT;

-- Preserve legacy hotel-wide notifications by copying each one to every current member.
INSERT INTO "Notification" ("id", "hotelId", "recipientUserId", "type", "title", "body", "readAt", "createdAt")
SELECT 'legacy_' || md5(random()::text || clock_timestamp()::text || membership."userId"),
       notification."hotelId", membership."userId", notification."type", notification."title",
       notification."body", notification."readAt", notification."createdAt"
FROM "Notification" notification
JOIN "Membership" membership ON membership."hotelId" = notification."hotelId"
WHERE notification."recipientUserId" IS NULL;

DELETE FROM "Notification" WHERE "recipientUserId" IS NULL;

ALTER TABLE "Membership"
ADD CONSTRAINT "Membership_digestHour_check" CHECK ("digestHour" BETWEEN 6 AND 14);

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Notification_hotelId_readAt_idx";
CREATE UNIQUE INDEX "Notification_hotelId_recipientUserId_dedupeKey_key"
ON "Notification"("hotelId", "recipientUserId", "dedupeKey");
CREATE INDEX "Notification_recipientUserId_hotelId_readAt_createdAt_idx"
ON "Notification"("recipientUserId", "hotelId", "readAt", "createdAt");
