-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- DropForeignKey
ALTER TABLE "InteractionInstance" DROP CONSTRAINT "InteractionInstance_responsibleUserId_fkey";

-- DropForeignKey
ALTER TABLE "InteractionInstance" DROP CONSTRAINT "InteractionInstance_universityId_fkey";

-- AlterTable
ALTER TABLE "InteractionInstance" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "universityId" DROP NOT NULL,
ALTER COLUMN "responsibleUserId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CourseMapping" (
    "id" TEXT NOT NULL,
    "course" TEXT NOT NULL,
    "itDirectionId" TEXT,
    "itProductId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSyncRun" (
    "id" TEXT NOT NULL,
    "status" "SyncRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedDuplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "IntegrationSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseMapping_course_key" ON "CourseMapping"("course");

-- CreateIndex
CREATE INDEX "CourseMapping_itDirectionId_idx" ON "CourseMapping"("itDirectionId");

-- CreateIndex
CREATE INDEX "CourseMapping_itProductId_idx" ON "CourseMapping"("itProductId");

-- CreateIndex
CREATE UNIQUE INDEX "InteractionInstance_externalId_key" ON "InteractionInstance"("externalId");

-- AddForeignKey
ALTER TABLE "InteractionInstance" ADD CONSTRAINT "InteractionInstance_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InteractionInstance" ADD CONSTRAINT "InteractionInstance_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMapping" ADD CONSTRAINT "CourseMapping_itDirectionId_fkey" FOREIGN KEY ("itDirectionId") REFERENCES "ItDirection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMapping" ADD CONSTRAINT "CourseMapping_itProductId_fkey" FOREIGN KEY ("itProductId") REFERENCES "ItProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

