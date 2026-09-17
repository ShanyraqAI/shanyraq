CREATE TABLE "DocumentProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL DEFAULT 'INDIVIDUAL_ENTREPRENEUR',
  "legalName" TEXT NOT NULL,
  "iinBin" TEXT NOT NULL,
  "identityDocument" TEXT,
  "postalCode" TEXT,
  "legalAddress" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "bankName" TEXT,
  "iban" TEXT,
  "bic" TEXT,
  "kbe" TEXT,
  "signerName" TEXT NOT NULL,
  "signerTitle" TEXT NOT NULL DEFAULT 'Руководитель',
  "signerAuthority" TEXT,
  "accountantName" TEXT,
  "vatMode" TEXT NOT NULL DEFAULT 'WITHOUT_VAT',
  "vatRegistrationNumber" TEXT,
  "defaultPaymentTerms" TEXT NOT NULL DEFAULT 'Оплата наличными или переводом',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentSequence" (
  "organizationId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("organizationId", "type")
);

CREATE TABLE "GeneratedDocument" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "documentDate" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentProfile_organizationId_key" ON "DocumentProfile"("organizationId");
CREATE UNIQUE INDEX "GeneratedDocument_organizationId_type_sequenceNumber_key" ON "GeneratedDocument"("organizationId", "type", "sequenceNumber");
CREATE INDEX "GeneratedDocument_hotelId_createdAt_idx" ON "GeneratedDocument"("hotelId", "createdAt");
CREATE INDEX "GeneratedDocument_reservationId_createdAt_idx" ON "GeneratedDocument"("reservationId", "createdAt");

ALTER TABLE "DocumentProfile" ADD CONSTRAINT "DocumentProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
