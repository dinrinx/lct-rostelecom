-- AlterTable
ALTER TABLE "WorkflowStatus" ADD COLUMN     "dependsOnStatusIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "isOptional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "slaDays" INTEGER;
