-- Additive and repeatable: existing names and sessions remain untouched.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;

-- Pending registrations exist only on installations with email verification.
DO $$
BEGIN
  IF to_regclass('"EmailRegistration"') IS NOT NULL THEN
    ALTER TABLE "EmailRegistration" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
    ALTER TABLE "EmailRegistration" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
  END IF;
END $$;
