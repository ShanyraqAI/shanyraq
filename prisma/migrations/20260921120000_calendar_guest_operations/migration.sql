ALTER TABLE "Room" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CalendarPreference" ADD COLUMN "reservationColors" TEXT NOT NULL DEFAULT 'BRIGHT';
ALTER TABLE "Reservation" ADD COLUMN "paymentMethod" TEXT;

CREATE TABLE "GuestNote" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestNote_hotelId_guestId_createdAt_idx" ON "GuestNote"("hotelId", "guestId", "createdAt");
ALTER TABLE "GuestNote" ADD CONSTRAINT "GuestNote_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestNote" ADD CONSTRAINT "GuestNote_guestId_hotelId_fkey" FOREIGN KEY ("guestId", "hotelId") REFERENCES "Guest"("id", "hotelId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestNote" ADD CONSTRAINT "GuestNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
