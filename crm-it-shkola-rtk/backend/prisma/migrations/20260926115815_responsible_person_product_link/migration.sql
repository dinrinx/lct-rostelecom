-- DropForeignKey
ALTER TABLE "ResponsiblePerson" DROP CONSTRAINT "ResponsiblePerson_universityId_fkey";

-- AlterTable
ALTER TABLE "ResponsiblePerson" ADD COLUMN     "contactMethod" TEXT,
ADD COLUMN     "itProductId" TEXT,
ALTER COLUMN "universityId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ResponsiblePerson_itProductId_idx" ON "ResponsiblePerson"("itProductId");

-- AddForeignKey
ALTER TABLE "ResponsiblePerson" ADD CONSTRAINT "ResponsiblePerson_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponsiblePerson" ADD CONSTRAINT "ResponsiblePerson_itProductId_fkey" FOREIGN KEY ("itProductId") REFERENCES "ItProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

