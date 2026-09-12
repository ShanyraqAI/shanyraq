-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Availability" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "availableRooms" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "minStay" INTEGER NOT NULL DEFAULT 1,
    "maxStay" INTEGER,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChannelConnection" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "externalPropertyId" TEXT,
    "credentialsJson" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastError" TEXT,
    "importCursor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChannelRateMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "externalRateId" TEXT NOT NULL,
    "externalRateName" TEXT NOT NULL,
    "mappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelRateMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChannelRoomMapping" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "externalRoomTypeId" TEXT NOT NULL,
    "externalRoomName" TEXT NOT NULL,
    "mappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelRoomMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Guest" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "notes" TEXT,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Hotel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "propertyType" TEXT,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hotelId" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'FULL',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rate" (
    "id" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RatePlan" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "refundable" BOOLEAN NOT NULL DEFAULT true,
    "breakfastIncluded" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reservation" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "sourceChannel" TEXT NOT NULL,
    "externalReservationId" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Room" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomType" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "reservationsImported" INTEGER NOT NULL DEFAULT 0,
    "ratesUpdated" INTEGER NOT NULL DEFAULT 0,
    "availabilityUpdated" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_OrganizationToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OrganizationToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "AuditLog_hotelId_createdAt_idx" ON "public"."AuditLog"("hotelId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Availability_hotelId_date_idx" ON "public"."Availability"("hotelId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Availability_hotelId_roomTypeId_date_key" ON "public"."Availability"("hotelId" ASC, "roomTypeId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_hotelId_channelId_key" ON "public"."ChannelConnection"("hotelId" ASC, "channelId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelRateMapping_connectionId_ratePlanId_key" ON "public"."ChannelRateMapping"("connectionId" ASC, "ratePlanId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelRoomMapping_connectionId_roomTypeId_key" ON "public"."ChannelRoomMapping"("connectionId" ASC, "roomTypeId" ASC);

-- CreateIndex
CREATE INDEX "Guest_hotelId_fullName_idx" ON "public"."Guest"("hotelId" ASC, "fullName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Hotel_slug_key" ON "public"."Hotel"("slug" ASC);

-- CreateIndex
CREATE INDEX "Membership_organizationId_userId_idx" ON "public"."Membership"("organizationId" ASC, "userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_hotelId_key" ON "public"."Membership"("userId" ASC, "hotelId" ASC);

-- CreateIndex
CREATE INDEX "Notification_hotelId_readAt_idx" ON "public"."Notification"("hotelId" ASC, "readAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Rate_ratePlanId_date_key" ON "public"."Rate"("ratePlanId" ASC, "date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RatePlan_hotelId_name_key" ON "public"."RatePlan"("hotelId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "Reservation_hotelId_checkIn_idx" ON "public"."Reservation"("hotelId" ASC, "checkIn" ASC);

-- CreateIndex
CREATE INDEX "Reservation_hotelId_status_idx" ON "public"."Reservation"("hotelId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "Reservation_roomId_checkIn_checkOut_idx" ON "public"."Reservation"("roomId" ASC, "checkIn" ASC, "checkOut" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Room_hotelId_number_key" ON "public"."Room"("hotelId" ASC, "number" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_hotelId_name_key" ON "public"."RoomType"("hotelId" ASC, "name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "public"."Session"("tokenHash" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId" ASC);

-- CreateIndex
CREATE INDEX "SyncLog_connectionId_startedAt_idx" ON "public"."SyncLog"("connectionId" ASC, "startedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone" ASC);

-- CreateIndex
CREATE INDEX "_OrganizationToUser_B_index" ON "public"."_OrganizationToUser"("B" ASC);

-- AddForeignKey
ALTER TABLE "public"."Availability" ADD CONSTRAINT "Availability_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Availability" ADD CONSTRAINT "Availability_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "public"."RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChannelConnection" ADD CONSTRAINT "ChannelConnection_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "public"."Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChannelConnection" ADD CONSTRAINT "ChannelConnection_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChannelRateMapping" ADD CONSTRAINT "ChannelRateMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChannelRateMapping" ADD CONSTRAINT "ChannelRateMapping_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "public"."RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChannelRoomMapping" ADD CONSTRAINT "ChannelRoomMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChannelRoomMapping" ADD CONSTRAINT "ChannelRoomMapping_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "public"."RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Guest" ADD CONSTRAINT "Guest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Hotel" ADD CONSTRAINT "Hotel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rate" ADD CONSTRAINT "Rate_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "public"."RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RatePlan" ADD CONSTRAINT "RatePlan_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RatePlan" ADD CONSTRAINT "RatePlan_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "public"."RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "public"."Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "public"."RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "public"."RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomType" ADD CONSTRAINT "RoomType_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "public"."Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncLog" ADD CONSTRAINT "SyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "public"."ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OrganizationToUser" ADD CONSTRAINT "_OrganizationToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OrganizationToUser" ADD CONSTRAINT "_OrganizationToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
