-- Monetary values must use exact fixed-point arithmetic. Existing floating
-- values are rounded to the application's supported two decimal places.
ALTER TABLE "RoomType"
  ALTER COLUMN "basePrice" TYPE DECIMAL(14,2) USING ROUND("basePrice"::numeric, 2);

ALTER TABLE "Reservation"
  ALTER COLUMN "totalAmount" TYPE DECIMAL(14,2) USING ROUND("totalAmount"::numeric, 2);

ALTER TABLE "RatePlan"
  ALTER COLUMN "basePrice" TYPE DECIMAL(14,2) USING ROUND("basePrice"::numeric, 2);

ALTER TABLE "Rate"
  ALTER COLUMN "price" TYPE DECIMAL(14,2) USING ROUND("price"::numeric, 2);

ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_basePrice_nonnegative" CHECK ("basePrice" >= 0);
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_totalAmount_nonnegative" CHECK ("totalAmount" >= 0);
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_basePrice_positive" CHECK ("basePrice" > 0);
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_price_positive" CHECK ("price" > 0);
