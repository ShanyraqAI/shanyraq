ALTER TABLE "TTLockLock"
  ADD COLUMN "batteryPercent" INTEGER,
  ADD COLUMN "hasGateway" BOOLEAN,
  ADD COLUMN "isOnline" BOOLEAN,
  ADD COLUMN "lockState" TEXT,
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "TTLockLock_id_hotelId_key" ON "TTLockLock"("id", "hotelId");

CREATE TABLE "TTLockEvent" (
  "id" TEXT NOT NULL,
  "hotelId" TEXT NOT NULL,
  "lockRefId" TEXT,
  "eventKey" TEXT NOT NULL,
  "lockId" TEXT NOT NULL,
  "recordType" INTEGER,
  "success" BOOLEAN,
  "actor" TEXT,
  "eventAt" TIMESTAMP(3),
  "summary" TEXT,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TTLockEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TTLockEvent_hotelId_eventKey_key" ON "TTLockEvent"("hotelId", "eventKey");
CREATE INDEX "TTLockEvent_hotelId_eventAt_idx" ON "TTLockEvent"("hotelId", "eventAt");
CREATE INDEX "TTLockEvent_lockRefId_eventAt_idx" ON "TTLockEvent"("lockRefId", "eventAt");
ALTER TABLE "TTLockEvent" ADD CONSTRAINT "TTLockEvent_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TTLockEvent" ADD CONSTRAINT "TTLockEvent_lockRefId_hotelId_fkey" FOREIGN KEY ("lockRefId", "hotelId") REFERENCES "TTLockLock"("id", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;
