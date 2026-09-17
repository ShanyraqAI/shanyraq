ALTER TABLE "Reservation"
ADD COLUMN "checkInTime" TEXT NOT NULL DEFAULT '14:00',
ADD COLUMN "checkOutTime" TEXT NOT NULL DEFAULT '12:00',
ADD COLUMN "pricingMode" TEXT NOT NULL DEFAULT 'RATE_PLAN';

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_checkInTime_format" CHECK ("checkInTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
ADD CONSTRAINT "Reservation_checkOutTime_format" CHECK ("checkOutTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
ADD CONSTRAINT "Reservation_pricingMode_values" CHECK ("pricingMode" IN ('RATE_PLAN', 'MANUAL'));

ALTER TABLE "CalendarPreference" ALTER COLUMN "showAmount" SET DEFAULT true;
