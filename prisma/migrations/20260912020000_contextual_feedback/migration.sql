-- Closed-beta contextual feedback after the first reservation.
-- Additive columns only; existing support requests and product progress are preserved.

ALTER TABLE "ProductExperience"
  ADD COLUMN "feedbackSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "feedbackDismissedAt" TIMESTAMP(3);

ALTER TABLE "SupportRequest"
  ADD COLUMN "rating" INTEGER,
  ADD COLUMN "feedbackTrigger" TEXT,
  ADD COLUMN "technicalContextJson" TEXT;

ALTER TABLE "SupportRequest"
DROP CONSTRAINT "SupportRequest_category_check";

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_category_check"
CHECK ("category" IN ('QUESTION', 'PROBLEM', 'CONFUSING', 'SUGGESTION'));

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_rating_check"
CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_feedbackTrigger_check"
CHECK ("feedbackTrigger" IS NULL OR "feedbackTrigger" IN ('FIRST_RESERVATION'));

CREATE INDEX "SupportRequest_feedbackTrigger_createdAt_idx" ON "SupportRequest"("feedbackTrigger", "createdAt");
