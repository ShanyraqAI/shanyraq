-- CreateTable
CREATE TABLE "CommunicationProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "publicName" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "mapLink" TEXT NOT NULL DEFAULT '',
    "wifiName" TEXT NOT NULL DEFAULT '',
    "wifiPassword" TEXT NOT NULL DEFAULT '',
    "keyInstructions" TEXT NOT NULL DEFAULT '',
    "rulesLink" TEXT NOT NULL DEFAULT '',
    "checkinGuideLink" TEXT NOT NULL DEFAULT '',
    "supportPhone" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT,
    "name" VARCHAR(160) NOT NULL,
    "body" VARCHAR(4096) NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "bytes" BYTEA NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestCommunication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "recipientPhone" TEXT NOT NULL,
    "body" VARCHAR(4096) NOT NULL,
    "attachments" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handoffAt" TIMESTAMP(3),

    CONSTRAINT "GuestCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationProfile_roomId_key" ON "CommunicationProfile"("roomId");

-- CreateIndex
CREATE INDEX "CommunicationProfile_organizationId_hotelId_idx" ON "CommunicationProfile"("organizationId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationProfile_roomId_hotelId_key" ON "CommunicationProfile"("roomId", "hotelId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_organizationId_hotelId_status_idx" ON "CommunicationTemplate"("organizationId", "hotelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplate_id_hotelId_key" ON "CommunicationTemplate"("id", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationTemplateVersion_templateId_version_key" ON "CommunicationTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "CommunicationPhoto_organizationId_hotelId_roomId_archivedAt_idx" ON "CommunicationPhoto"("organizationId", "hotelId", "roomId", "archivedAt");

-- CreateIndex
CREATE INDEX "GuestCommunication_organizationId_hotelId_createdAt_id_idx" ON "GuestCommunication"("organizationId", "hotelId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "GuestCommunication_hotelId_requestKey_key" ON "GuestCommunication"("hotelId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_id_roomId_hotelId_key" ON "Reservation"("id", "roomId", "hotelId");

-- AddForeignKey
ALTER TABLE "CommunicationProfile" ADD CONSTRAINT "CommunicationProfile_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationProfile" ADD CONSTRAINT "CommunicationProfile_roomId_hotelId_fkey" FOREIGN KEY ("roomId", "hotelId") REFERENCES "Room"("id", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_roomId_hotelId_fkey" FOREIGN KEY ("roomId", "hotelId") REFERENCES "Room"("id", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTemplateVersion" ADD CONSTRAINT "CommunicationTemplateVersion_templateId_hotelId_fkey" FOREIGN KEY ("templateId", "hotelId") REFERENCES "CommunicationTemplate"("id", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPhoto" ADD CONSTRAINT "CommunicationPhoto_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPhoto" ADD CONSTRAINT "CommunicationPhoto_roomId_hotelId_fkey" FOREIGN KEY ("roomId", "hotelId") REFERENCES "Room"("id", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCommunication" ADD CONSTRAINT "GuestCommunication_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCommunication" ADD CONSTRAINT "GuestCommunication_roomId_hotelId_fkey" FOREIGN KEY ("roomId", "hotelId") REFERENCES "Room"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCommunication" ADD CONSTRAINT "GuestCommunication_reservationId_roomId_hotelId_fkey" FOREIGN KEY ("reservationId", "roomId", "hotelId") REFERENCES "Reservation"("id", "roomId", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCommunication" ADD CONSTRAINT "GuestCommunication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CommunicationTemplate"
  ADD CONSTRAINT "CommunicationTemplate_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
  ADD CONSTRAINT "CommunicationTemplate_language_check" CHECK ("language" IN ('ru', 'kk', 'en')),
  ADD CONSTRAINT "CommunicationTemplate_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "CommunicationTemplate_default_check" CHECK (NOT "isDefault" OR "status" = 'ACTIVE');
ALTER TABLE "CommunicationPhoto"
  ADD CONSTRAINT "CommunicationPhoto_content_check" CHECK ("contentType" = 'image/jpeg'),
  ADD CONSTRAINT "CommunicationPhoto_size_check" CHECK (octet_length("bytes") BETWEEN 1 AND 1048576);
ALTER TABLE "GuestCommunication"
  ADD CONSTRAINT "GuestCommunication_state_check" CHECK ("state" IN ('DRAFT', 'MANUAL_WHATSAPP_OPENED', 'SHARE_RETURNED')),
  ADD CONSTRAINT "GuestCommunication_phone_check" CHECK ("recipientPhone" ~ '^[1-9][0-9]{9,14}$');
CREATE UNIQUE INDEX "CommunicationTemplate_one_default_per_scope"
  ON "CommunicationTemplate" ("hotelId", COALESCE("roomId", ''), "language") WHERE "isDefault" = true;
