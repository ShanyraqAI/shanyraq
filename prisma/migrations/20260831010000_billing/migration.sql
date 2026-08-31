ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "BillingSubscription" (
  "organizationId" TEXT PRIMARY KEY REFERENCES "Organization"("id") ON DELETE CASCADE,
  "trialStartsAt" TIMESTAMP(3) NOT NULL,
  "trialEndsAt" TIMESTAMP(3) NOT NULL,
  "paidUntil" TIMESTAMP(3),
  "planId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "BillingPayment" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "planId" TEXT NOT NULL,
  "months" INTEGER NOT NULL CHECK ("months" IN (1,12)),
  "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" > 0),
  "currency" TEXT NOT NULL DEFAULT 'KZT',
  "testMode" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "providerPaymentId" TEXT UNIQUE,
  "checkoutUrl" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "BillingPayment_organizationId_createdAt_idx" ON "BillingPayment"("organizationId", "createdAt");
CREATE TABLE "BillingNotice" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "leaseUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "BillingNotice_period_recipient_key" ON "BillingNotice"("organizationId", "userId", "kind", "periodEnd");
