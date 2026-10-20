CREATE TABLE "TelegramCommandReceipt" (
  "updateId" BIGINT NOT NULL,
  "commandHash" VARCHAR(64) NOT NULL,
  "response" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TelegramCommandReceipt_pkey" PRIMARY KEY ("updateId")
);
