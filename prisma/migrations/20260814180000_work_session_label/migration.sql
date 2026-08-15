-- The editor names the video when they start the clock; the submission itself
-- is only created at the end, once they know the duration. So a session has to
-- be able to exist before its submission does.

-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN "label" TEXT NOT NULL DEFAULT '';

-- DropForeignKey
ALTER TABLE "WorkSession" DROP CONSTRAINT "WorkSession_submissionId_fkey";

-- AlterTable
ALTER TABLE "WorkSession" ALTER COLUMN "submissionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "VideoSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
