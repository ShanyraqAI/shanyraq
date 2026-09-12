CREATE TABLE "ChannelSyncJob" (
  "id" TEXT PRIMARY KEY,
  "hotelId" TEXT NOT NULL REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "connectionId" TEXT NOT NULL,
  "deduplicationKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 6,
  "rerunRequested" BOOLEAN NOT NULL DEFAULT FALSE,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "finishedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelSyncJob_status_check" CHECK ("status" IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT "ChannelSyncJob_attempts_check" CHECK ("attempts" >= 0 AND "maxAttempts" > 0)
);

CREATE UNIQUE INDEX "ChannelConnection_id_hotelId_key" ON "ChannelConnection"("id", "hotelId");
ALTER TABLE "ChannelSyncJob"
  ADD CONSTRAINT "ChannelSyncJob_connectionId_hotelId_fkey"
  FOREIGN KEY ("connectionId", "hotelId") REFERENCES "ChannelConnection"("id", "hotelId")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ChannelSyncJob_deduplicationKey_key" ON "ChannelSyncJob"("deduplicationKey");
CREATE INDEX "ChannelSyncJob_status_availableAt_idx" ON "ChannelSyncJob"("status", "availableAt");
CREATE INDEX "ChannelSyncJob_hotelId_createdAt_idx" ON "ChannelSyncJob"("hotelId", "createdAt");
CREATE INDEX "ChannelSyncJob_connectionId_createdAt_idx" ON "ChannelSyncJob"("connectionId", "createdAt");
