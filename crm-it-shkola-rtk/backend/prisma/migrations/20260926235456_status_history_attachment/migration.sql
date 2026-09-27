-- AlterTable
ALTER TABLE "StatusHistoryEntry" ADD COLUMN     "attachmentId" TEXT;

-- CreateIndex
CREATE INDEX "StatusHistoryEntry_attachmentId_idx" ON "StatusHistoryEntry"("attachmentId");

-- AddForeignKey
ALTER TABLE "StatusHistoryEntry" ADD CONSTRAINT "StatusHistoryEntry_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
