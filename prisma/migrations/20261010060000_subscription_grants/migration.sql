CREATE TABLE "SubscriptionGrant" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "planId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "months" INTEGER NOT NULL,
  "note" TEXT,
  "grantedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SubscriptionGrant_organizationId_endsAt_idx" ON "SubscriptionGrant"("organizationId", "endsAt");
