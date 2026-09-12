-- Extend the existing support inbox so public visitors can hand off an AI
-- conversation without weakening tenant isolation for authenticated tickets.
ALTER TABLE "SupportRequest"
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ALTER COLUMN "hotelId" DROP NOT NULL,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "contact" TEXT,
  ADD COLUMN "transcriptJson" TEXT;
