ALTER TABLE "Rate"
ADD COLUMN "minStay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "minStayType" TEXT NOT NULL DEFAULT 'ARRIVAL',
ADD COLUMN "maxStay" INTEGER,
ADD COLUMN "stopSell" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "closedToArrival" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "closedToDeparture" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Rate"
ADD CONSTRAINT "Rate_minStay_range" CHECK ("minStay" BETWEEN 1 AND 730),
ADD CONSTRAINT "Rate_minStayType_allowed" CHECK ("minStayType" IN ('ARRIVAL', 'THROUGH')),
ADD CONSTRAINT "Rate_maxStay_range" CHECK ("maxStay" IS NULL OR "maxStay" BETWEEN 1 AND 730),
ADD CONSTRAINT "Rate_maxStay_not_below_minStay" CHECK ("maxStay" IS NULL OR "maxStay" >= "minStay");
