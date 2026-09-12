-- Repair the only unambiguous legacy case: a membership without hotelId whose
-- organization owns exactly one hotel and which does not duplicate access.
UPDATE "Membership" m
SET "hotelId" = candidate."hotelId"
FROM (
  SELECT m2.id AS "membershipId", MIN(h.id) AS "hotelId"
  FROM "Membership" m2
  JOIN "Hotel" h ON h."orgId" = m2."organizationId"
  WHERE m2."hotelId" IS NULL
  GROUP BY m2.id
  HAVING COUNT(h.id) = 1
) candidate
WHERE m.id = candidate."membershipId"
  AND NOT EXISTS (
    SELECT 1 FROM "Membership" existing
    WHERE existing."userId" = m."userId" AND existing."hotelId" = candidate."hotelId"
  );

-- Abort before any DDL if legacy rows would violate the new tenant boundaries.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Hotel" WHERE "orgId" IS NULL) THEN
    RAISE EXCEPTION 'Security migration blocked: Hotel.orgId contains NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM "Membership" WHERE "hotelId" IS NULL) THEN
    RAISE EXCEPTION 'Security migration blocked: Membership.hotelId contains NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Membership" m JOIN "Hotel" h ON h.id = m."hotelId"
    WHERE m."organizationId" <> h."orgId"
  ) THEN RAISE EXCEPTION 'Security migration blocked: cross-organization membership'; END IF;
  IF EXISTS (
    SELECT 1 FROM "Reservation" r JOIN "Guest" g ON g.id = r."guestId"
    WHERE r."hotelId" <> g."hotelId"
  ) THEN RAISE EXCEPTION 'Security migration blocked: cross-hotel reservation guest'; END IF;
  IF EXISTS (
    SELECT 1 FROM "Reservation" r JOIN "Room" room ON room.id = r."roomId"
    WHERE r."hotelId" <> room."hotelId"
  ) THEN RAISE EXCEPTION 'Security migration blocked: cross-hotel reservation room'; END IF;
  IF EXISTS (
    SELECT 1 FROM "Reservation" r JOIN "RoomType" rt ON rt.id = r."roomTypeId"
    WHERE r."hotelId" <> rt."hotelId"
  ) THEN RAISE EXCEPTION 'Security migration blocked: cross-hotel reservation room type'; END IF;
  IF EXISTS (
    SELECT 1 FROM "Reservation"
    WHERE "externalReservationId" IS NOT NULL
    GROUP BY "hotelId", "sourceChannel", "externalReservationId" HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'Security migration blocked: duplicate external reservation ids'; END IF;
END $$;

-- DropForeignKey
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_roomTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Hotel" DROP CONSTRAINT "Hotel_orgId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_hotelId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_guestId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_roomTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_roomTypeId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorUserId" TEXT;

-- AlterTable
ALTER TABLE "ChannelConnection" ADD COLUMN     "credentialsEncrypted" TEXT;

-- AlterTable
ALTER TABLE "Hotel" ALTER COLUMN "orgId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Membership" ALTER COLUMN "hotelId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "ratePlanId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- Existing pre-launch accounts are grandfathered once; all new email accounts
-- are created only after a verification code succeeds.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "email" IS NOT NULL AND "emailVerifiedAt" IS NULL;

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "HotelInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailRegistration_email_key" ON "EmailRegistration"("email");

-- CreateIndex
CREATE INDEX "EmailRegistration_expiresAt_idx" ON "EmailRegistration"("expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE INDEX "HotelInvitation_email_status_idx" ON "HotelInvitation"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HotelInvitation_hotelId_email_key" ON "HotelInvitation"("hotelId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_id_hotelId_key" ON "Guest"("id", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_id_orgId_key" ON "Hotel"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "RatePlan_id_hotelId_key" ON "RatePlan"("id", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_hotelId_sourceChannel_externalReservationId_key" ON "Reservation"("hotelId", "sourceChannel", "externalReservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Room_id_hotelId_key" ON "Room"("id", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_id_hotelId_key" ON "RoomType"("id", "hotelId");

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelInvitation" ADD CONSTRAINT "HotelInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelInvitation" ADD CONSTRAINT "HotelInvitation_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelInvitation" ADD CONSTRAINT "HotelInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_hotelId_fkey" FOREIGN KEY ("roomTypeId", "hotelId") REFERENCES "RoomType"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_hotelId_fkey" FOREIGN KEY ("guestId", "hotelId") REFERENCES "Guest"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_hotelId_fkey" FOREIGN KEY ("roomId", "hotelId") REFERENCES "Room"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomTypeId_hotelId_fkey" FOREIGN KEY ("roomTypeId", "hotelId") REFERENCES "RoomType"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ratePlanId_hotelId_fkey" FOREIGN KEY ("ratePlanId", "hotelId") REFERENCES "RatePlan"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_roomTypeId_hotelId_fkey" FOREIGN KEY ("roomTypeId", "hotelId") REFERENCES "RoomType"("id", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants are enforced by PostgreSQL as well as Zod.
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_valid_dates" CHECK ("checkOut" > "checkIn");
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_status_check" CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','CHECKED_IN','CHECKED_OUT','NO_SHOW'));
ALTER TABLE "Room" ADD CONSTRAINT "Room_status_check" CHECK (status IN ('AVAILABLE','OCCUPIED','CLEANING','MAINTENANCE','OUT_OF_ORDER'));
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_role_check" CHECK (role IN ('OWNER','MANAGER','STAFF'));
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_access_check" CHECK ("accessLevel" IN ('OVERVIEW','CALENDAR','FULL'));
ALTER TABLE "HotelInvitation" ADD CONSTRAINT "HotelInvitation_access_check" CHECK ("accessLevel" IN ('OVERVIEW','CALENDAR','FULL'));
ALTER TABLE "HotelInvitation" ADD CONSTRAINT "HotelInvitation_status_check" CHECK (status IN ('PENDING','ACCEPTED','CANCELLED','EXPIRED'));
