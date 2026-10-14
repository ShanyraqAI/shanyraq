-- AlterTable
ALTER TABLE "GuestCommunication" ALTER COLUMN "recipientPhone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DocumentSigningRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "pdfBytes" BYTEA NOT NULL,
    "pdfHash" VARCHAR(64) NOT NULL,
    "reservationVersion" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signerName" VARCHAR(160),
    "consentVersion" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSigningRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSigningRequest_tokenHash_key" ON "DocumentSigningRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "DocumentSigningRequest_organizationId_hotelId_reservationId_idx" ON "DocumentSigningRequest"("organizationId", "hotelId", "reservationId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentSigningRequest_documentId_signedAt_idx" ON "DocumentSigningRequest"("documentId", "signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_id_organizationId_hotelId_reservationId_key" ON "GeneratedDocument"("id", "organizationId", "hotelId", "reservationId");

-- AddForeignKey
ALTER TABLE "DocumentSigningRequest" ADD CONSTRAINT "DocumentSigningRequest_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSigningRequest" ADD CONSTRAINT "DocumentSigningRequest_reservationId_hotelId_fkey" FOREIGN KEY ("reservationId", "hotelId") REFERENCES "Reservation"("id", "hotelId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSigningRequest" ADD CONSTRAINT "DocumentSigningRequest_documentId_organizationId_hotelId_r_fkey" FOREIGN KEY ("documentId", "organizationId", "hotelId", "reservationId") REFERENCES "GeneratedDocument"("id", "organizationId", "hotelId", "reservationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSigningRequest" ADD CONSTRAINT "DocumentSigningRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guard frozen document bytes, capability hashes and signed evidence consistency.
ALTER TABLE "DocumentSigningRequest"
  ADD CONSTRAINT "DocumentSigningRequest_pdf_size_check" CHECK (octet_length("pdfBytes") BETWEEN 1 AND 2097152),
  ADD CONSTRAINT "DocumentSigningRequest_hash_check" CHECK ("tokenHash" ~ '^[a-f0-9]{64}$' AND "pdfHash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "DocumentSigningRequest_evidence_check" CHECK (("signedAt" IS NULL AND "signerName" IS NULL AND "consentVersion" IS NULL AND "evidence" IS NULL) OR ("signedAt" IS NOT NULL AND "signerName" IS NOT NULL AND "consentVersion" IS NOT NULL AND "evidence" IS NOT NULL)),
  ADD CONSTRAINT "DocumentSigningRequest_expiry_check" CHECK ("expiresAt" > "createdAt");
