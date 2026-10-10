CREATE TABLE "Expense" (
  "id" TEXT PRIMARY KEY,
  "hotelId" TEXT NOT NULL REFERENCES "Hotel"("id") ON DELETE CASCADE,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL CHECK ("amount" > 0),
  "category" TEXT NOT NULL,
  "comment" TEXT,
  "roomIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Expense_hotelId_occurredAt_idx" ON "Expense"("hotelId", "occurredAt");
