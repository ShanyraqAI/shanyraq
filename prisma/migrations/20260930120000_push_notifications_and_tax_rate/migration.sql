ALTER TABLE "Hotel"
ADD COLUMN "incomeTaxRatePercent" DECIMAL(5,2);

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_hotelId_userId_endpointHash_key"
ON "PushSubscription"("hotelId", "userId", "endpointHash");

CREATE INDEX "PushSubscription_hotelId_userId_idx"
ON "PushSubscription"("hotelId", "userId");

ALTER TABLE "PushSubscription"
ADD CONSTRAINT "PushSubscription_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushSubscription"
ADD CONSTRAINT "PushSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
