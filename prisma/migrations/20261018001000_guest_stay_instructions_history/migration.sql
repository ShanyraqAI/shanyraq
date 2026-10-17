-- AlterTable
ALTER TABLE "GuestStayPolicy" ADD COLUMN     "checkoutInstructions" VARCHAR(2000) NOT NULL DEFAULT '',
ADD COLUMN     "entryPhotoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "parking" VARCHAR(2000) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "GuestStay" ADD COLUMN     "agreementHistoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

