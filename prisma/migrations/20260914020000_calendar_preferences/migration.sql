CREATE TABLE "CalendarPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "density" TEXT NOT NULL DEFAULT 'STANDARD',
    "showGuestName" BOOLEAN NOT NULL DEFAULT true,
    "showGuestCount" BOOLEAN NOT NULL DEFAULT true,
    "showChannel" BOOLEAN NOT NULL DEFAULT true,
    "showAmount" BOOLEAN NOT NULL DEFAULT false,
    "showReservationId" BOOLEAN NOT NULL DEFAULT false,
    "showNotes" BOOLEAN NOT NULL DEFAULT true,
    "collapsedRoomTypeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarPreference_userId_hotelId_key"
ON "CalendarPreference"("userId", "hotelId");

CREATE INDEX "CalendarPreference_hotelId_idx"
ON "CalendarPreference"("hotelId");

ALTER TABLE "CalendarPreference"
ADD CONSTRAINT "CalendarPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarPreference"
ADD CONSTRAINT "CalendarPreference_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
