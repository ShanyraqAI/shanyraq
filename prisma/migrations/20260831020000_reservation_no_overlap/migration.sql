-- Enforce room inventory for every writer, including simultaneous requests and imports.
-- No customer rows are changed. Existing conflicts cause the migration to abort.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_no_room_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tsrange("checkIn", "checkOut", '[)') WITH &&
  ) WHERE (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'));
COMMIT;
