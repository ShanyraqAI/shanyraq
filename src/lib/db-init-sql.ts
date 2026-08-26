// AUTO-GENERATED from prisma/schema.prisma — do not edit by hand.
// Regenerate with: npm run gen:sql
// Idempotent DDL so the app can bootstrap an empty SQLite database at runtime
// (used for the ephemeral demo deployment on Vercel and fresh local clones).

export const DB_INIT_SQL: string = `-- CreateTable
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "phone" TEXT,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Hotel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hotel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoomType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "basePrice" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RoomType_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT "Room_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Guest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "notes" TEXT,
    CONSTRAINT "Guest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "sourceChannel" TEXT NOT NULL,
    "externalReservationId" TEXT,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    "totalAmount" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Reservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RatePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "refundable" BOOLEAN NOT NULL DEFAULT true,
    "breakfastIncluded" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KZT',
    CONSTRAINT "RatePlan_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatePlan_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Rate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ratePlanId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "Rate_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "availableRooms" INTEGER NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "minStay" INTEGER NOT NULL DEFAULT 1,
    "maxStay" INTEGER,
    CONSTRAINT "Availability_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Availability_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChannelConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "externalPropertyId" TEXT,
    "credentialsJson" TEXT,
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastError" TEXT,
    "importCursor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChannelConnection_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelConnection_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChannelRoomMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "externalRoomTypeId" TEXT NOT NULL,
    "externalRoomName" TEXT NOT NULL,
    "mappedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelRoomMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelRoomMapping_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChannelRateMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "externalRateId" TEXT NOT NULL,
    "externalRateName" TEXT NOT NULL,
    "mappedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelRateMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelRateMapping_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL,
    "reservationsImported" INTEGER NOT NULL DEFAULT 0,
    "ratesUpdated" INTEGER NOT NULL DEFAULT 0,
    "availabilityUpdated" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "error" TEXT,
    CONSTRAINT "SyncLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hotelId" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'system',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "_OrganizationToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_OrganizationToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_OrganizationToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Hotel_slug_key" ON "Hotel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RoomType_hotelId_name_key" ON "RoomType"("hotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Room_hotelId_number_key" ON "Room"("hotelId", "number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Guest_hotelId_fullName_idx" ON "Guest"("hotelId", "fullName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_hotelId_checkIn_idx" ON "Reservation"("hotelId", "checkIn");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_hotelId_status_idx" ON "Reservation"("hotelId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_roomId_checkIn_checkOut_idx" ON "Reservation"("roomId", "checkIn", "checkOut");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RatePlan_hotelId_name_key" ON "RatePlan"("hotelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Rate_ratePlanId_date_key" ON "Rate"("ratePlanId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Availability_hotelId_date_idx" ON "Availability"("hotelId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Availability_hotelId_roomTypeId_date_key" ON "Availability"("hotelId", "roomTypeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelConnection_hotelId_channelId_key" ON "ChannelConnection"("hotelId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelRoomMapping_connectionId_roomTypeId_key" ON "ChannelRoomMapping"("connectionId", "roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelRateMapping_connectionId_ratePlanId_key" ON "ChannelRateMapping"("connectionId", "ratePlanId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncLog_connectionId_startedAt_idx" ON "SyncLog"("connectionId", "startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_hotelId_readAt_idx" ON "Notification"("hotelId", "readAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_hotelId_createdAt_idx" ON "AuditLog"("hotelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "_OrganizationToUser_AB_unique" ON "_OrganizationToUser"("A", "B");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "_OrganizationToUser_B_index" ON "_OrganizationToUser"("B");

`;
