-- Additive granular permissions. Empty arrays intentionally preserve the
-- existing accessLevel behavior in the application for current users.
ALTER TABLE "Membership"
ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "HotelInvitation"
ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
