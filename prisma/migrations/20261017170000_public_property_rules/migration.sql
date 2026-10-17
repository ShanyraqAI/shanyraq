-- CreateTable
CREATE TABLE "PublicPropertyRules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "rentalPropertyId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicPropertyRules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicRuleRevision" (
    "ruleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicRuleRevision_pkey" PRIMARY KEY ("ruleId","version")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicPropertyRules_rentalPropertyId_key" ON "PublicPropertyRules"("rentalPropertyId");

-- CreateIndex
CREATE INDEX "PublicPropertyRules_organizationId_hotelId_idx" ON "PublicPropertyRules"("organizationId", "hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicPropertyRules_rentalPropertyId_hotelId_organizationId_key" ON "PublicPropertyRules"("rentalPropertyId", "hotelId", "organizationId");

-- AddForeignKey
ALTER TABLE "PublicPropertyRules" ADD CONSTRAINT "PublicPropertyRules_hotelId_organizationId_fkey" FOREIGN KEY ("hotelId", "organizationId") REFERENCES "Hotel"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicPropertyRules" ADD CONSTRAINT "PublicPropertyRules_rentalPropertyId_hotelId_organizationI_fkey" FOREIGN KEY ("rentalPropertyId", "hotelId", "organizationId") REFERENCES "RentalProperty"("id", "hotelId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicPropertyRules" ADD CONSTRAINT "PublicPropertyRules_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRuleRevision" ADD CONSTRAINT "PublicRuleRevision_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PublicPropertyRules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

