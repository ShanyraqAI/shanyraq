-- Additive; keep successful receipts while offline clients may retry.
CREATE TABLE "OperationReceipt" (
 "userId" TEXT NOT NULL, "hotelId" TEXT NOT NULL, "key" VARCHAR(36) NOT NULL,
 "action" VARCHAR(80) NOT NULL, "requestHash" VARCHAR(64) NOT NULL,
 "resultJson" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId", "hotelId", "key"),
 FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Reservation_hotelId_roomTypeId_checkIn_checkOut_idx" ON "Reservation"("hotelId", "roomTypeId", "checkIn", "checkOut");
ALTER TABLE "ChannexBooking" ADD COLUMN "lastProviderRevisionAt" TIMESTAMP(3);
CREATE INDEX "Reservation_hotelId_guestId_checkIn_idx" ON "Reservation"("hotelId", "guestId", "checkIn");
