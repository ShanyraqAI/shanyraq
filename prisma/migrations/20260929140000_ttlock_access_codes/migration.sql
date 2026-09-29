CREATE TABLE "TTLockConnection" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TTLockConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TTLockLock" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "lockId" TEXT NOT NULL,
    "lockName" TEXT NOT NULL,
    "lockAlias" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TTLockLock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TTLockPasscode" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "lockId" TEXT NOT NULL,
    "reservationId" TEXT,
    "keyboardPwdId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TTLockPasscode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TTLockConnection_hotelId_key" ON "TTLockConnection"("hotelId");
CREATE INDEX "TTLockConnection_hotelId_idx" ON "TTLockConnection"("hotelId");
CREATE UNIQUE INDEX "TTLockLock_roomId_key" ON "TTLockLock"("roomId");
CREATE UNIQUE INDEX "TTLockLock_hotelId_lockId_key" ON "TTLockLock"("hotelId", "lockId");
CREATE INDEX "TTLockLock_hotelId_idx" ON "TTLockLock"("hotelId");
CREATE UNIQUE INDEX "TTLockPasscode_lockId_keyboardPwdId_key" ON "TTLockPasscode"("lockId", "keyboardPwdId");
CREATE INDEX "TTLockPasscode_hotelId_startsAt_endsAt_idx" ON "TTLockPasscode"("hotelId", "startsAt", "endsAt");
CREATE INDEX "TTLockPasscode_reservationId_idx" ON "TTLockPasscode"("reservationId");

ALTER TABLE "TTLockConnection" ADD CONSTRAINT "TTLockConnection_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TTLockLock" ADD CONSTRAINT "TTLockLock_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TTLockLock" ADD CONSTRAINT "TTLockLock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TTLockPasscode" ADD CONSTRAINT "TTLockPasscode_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TTLockPasscode" ADD CONSTRAINT "TTLockPasscode_lockId_fkey" FOREIGN KEY ("lockId") REFERENCES "TTLockLock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TTLockPasscode" ADD CONSTRAINT "TTLockPasscode_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
