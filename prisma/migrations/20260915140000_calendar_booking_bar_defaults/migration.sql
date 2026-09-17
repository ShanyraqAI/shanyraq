ALTER TABLE "CalendarPreference"
ADD COLUMN "currencyDisplay" TEXT NOT NULL DEFAULT 'SYMBOL';

ALTER TABLE "CalendarPreference"
ALTER COLUMN "showAmount" SET DEFAULT false,
ALTER COLUMN "showNotes" SET DEFAULT false;

ALTER TABLE "CalendarPreference"
ADD CONSTRAINT "CalendarPreference_currencyDisplay_check"
CHECK ("currencyDisplay" IN ('SYMBOL', 'CODE', 'HIDDEN'));
