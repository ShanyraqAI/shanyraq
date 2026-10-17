-- CreateTable
CREATE TABLE "AgreementBundle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "requestKey" VARCHAR(36) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "revision" VARCHAR(64) NOT NULL,
    "bundleHash" VARCHAR(64) NOT NULL,
    "ownerName" VARCHAR(160) NOT NULL,
    "ownerAcceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requireOtp" BOOLEAN NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "guestAcceptedAt" TIMESTAMP(3),
    "guestName" VARCHAR(160),
    "guestEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "required" BOOLEAN NOT NULL,
    "text" TEXT,
    "pdfBytes" BYTEA,
    "contentHash" VARCHAR(64) NOT NULL,
    "sourceDocumentId" TEXT,

    CONSTRAINT "AgreementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementEvent" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "actorId" TEXT,
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgreementOtp" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "requestKey" VARCHAR(36) NOT NULL,
    "phoneHash" VARCHAR(64) NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "state" VARCHAR(16) NOT NULL,
    "providerMessageId" VARCHAR(100),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgreementOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgreementBundle_tokenHash_key" ON "AgreementBundle"("tokenHash");

-- CreateIndex
CREATE INDEX "AgreementBundle_organizationId_hotelId_reservationId_create_idx" ON "AgreementBundle"("organizationId", "hotelId", "reservationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementBundle_hotelId_requestKey_key" ON "AgreementBundle"("hotelId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementItem_bundleId_position_key" ON "AgreementItem"("bundleId", "position");

-- CreateIndex
CREATE INDEX "AgreementEvent_bundleId_createdAt_idx" ON "AgreementEvent"("bundleId", "createdAt");

-- CreateIndex
CREATE INDEX "AgreementOtp_phoneHash_createdAt_idx" ON "AgreementOtp"("phoneHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgreementOtp_bundleId_requestKey_key" ON "AgreementOtp"("bundleId", "requestKey");

-- AddForeignKey
ALTER TABLE "AgreementBundle" ADD CONSTRAINT "AgreementBundle_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementBundle" ADD CONSTRAINT "AgreementBundle_reservationId_hotelId_fkey" FOREIGN KEY ("reservationId", "hotelId") REFERENCES "Reservation"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementBundle" ADD CONSTRAINT "AgreementBundle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementItem" ADD CONSTRAINT "AgreementItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "AgreementBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementEvent" ADD CONSTRAINT "AgreementEvent_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "AgreementBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgreementOtp" ADD CONSTRAINT "AgreementOtp_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "AgreementBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Bounded states and immutable snapshot shape. No backfill or production mutation here.
ALTER TABLE "AgreementItem" ADD CONSTRAINT "AgreementItem_kind_check" CHECK ("kind" IN ('DOCUMENT','RULES','DEPOSIT','CANCELLATION','INFORMATION'));
ALTER TABLE "AgreementItem" ADD CONSTRAINT "AgreementItem_content_check" CHECK (("kind"='DOCUMENT' AND "pdfBytes" IS NOT NULL AND "text" IS NULL) OR ("kind"<>'DOCUMENT' AND "pdfBytes" IS NULL AND "text" IS NOT NULL));
ALTER TABLE "AgreementItem" ADD CONSTRAINT "AgreementItem_info_check" CHECK ("kind"<>'INFORMATION' OR NOT "required");
ALTER TABLE "AgreementItem" ADD CONSTRAINT "AgreementItem_hash_check" CHECK ("contentHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "AgreementOtp" ADD CONSTRAINT "AgreementOtp_state_check" CHECK ("state" IN ('PENDING','ACCEPTED','REJECTED','UNKNOWN'));
ALTER TABLE "AgreementOtp" ADD CONSTRAINT "AgreementOtp_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5);
ALTER TABLE "AgreementBundle" ADD CONSTRAINT "AgreementBundle_hash_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$' AND "bundleHash" ~ '^[a-f0-9]{64}$' AND "revision" ~ '^[a-f0-9]{64}$');
