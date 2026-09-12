-- Closed-beta support workflow: assignment, resolution timestamp and immutable activity history.
-- Additive only; existing requests remain OPEN and unassigned.

ALTER TABLE "SupportRequest"
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE TABLE "SupportRequestActivity" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "type" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportRequestActivity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupportRequestActivity"
ADD CONSTRAINT "SupportRequestActivity_type_check"
CHECK ("type" IN ('STATUS_CHANGE', 'NOTE', 'ASSIGNMENT'));

CREATE INDEX "SupportRequest_assignedToId_status_idx" ON "SupportRequest"("assignedToId", "status");
CREATE INDEX "SupportRequestActivity_requestId_createdAt_idx" ON "SupportRequestActivity"("requestId", "createdAt");
CREATE INDEX "SupportRequestActivity_actorUserId_createdAt_idx" ON "SupportRequestActivity"("actorUserId", "createdAt");

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupportRequestActivity"
ADD CONSTRAINT "SupportRequestActivity_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportRequestActivity"
ADD CONSTRAINT "SupportRequestActivity_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
