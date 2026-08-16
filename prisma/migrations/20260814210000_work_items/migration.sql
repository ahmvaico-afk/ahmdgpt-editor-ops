-- Work gains a lifecycle: an editor submits to QA, may resume for revisions,
-- and finally finishes. That state belongs to the video being worked on, not
-- to an individual span of the clock, so spans now hang off a WorkItem.

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('working', 'submitted', 'finished');

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "submissionId" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'working',
    "finishedAt" TIMESTAMP(3),
    "timeApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- Carry every existing span across as its own work item, so no logged time is
-- lost. Anything already attached to a video is treated as finished work.
INSERT INTO "WorkItem" ("id", "editorId", "label", "submissionId", "status", "finishedAt", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    w."editorId",
    COALESCE(NULLIF(w."label", ''), 'Untitled'),
    w."submissionId",
    CASE
        WHEN w."endedAt" IS NULL THEN 'working'::"WorkItemStatus"
        WHEN w."submissionId" IS NOT NULL THEN 'finished'::"WorkItemStatus"
        ELSE 'submitted'::"WorkItemStatus"
    END,
    CASE WHEN w."submissionId" IS NOT NULL THEN w."endedAt" ELSE NULL END,
    w."startedAt",
    CURRENT_TIMESTAMP
FROM "WorkSession" w;

-- AlterTable: point spans at their new parent
ALTER TABLE "WorkSession" ADD COLUMN "workItemId" TEXT;

UPDATE "WorkSession" w
SET "workItemId" = i."id"
FROM "WorkItem" i
WHERE i."editorId" = w."editorId"
  AND i."createdAt" = w."startedAt"
  AND (i."submissionId" IS NOT DISTINCT FROM w."submissionId");

-- Any span that somehow failed to match is dropped rather than left orphaned
-- with a NOT NULL column about to be added.
DELETE FROM "WorkSession" WHERE "workItemId" IS NULL;

ALTER TABLE "WorkSession" ALTER COLUMN "workItemId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_editorId_fkey";
ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_submissionId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "WorkSession_editorId_idx";
DROP INDEX IF EXISTS "WorkSession_submissionId_idx";

-- AlterTable: those columns live on WorkItem now
ALTER TABLE "WorkSession" DROP COLUMN "editorId";
ALTER TABLE "WorkSession" DROP COLUMN "submissionId";
ALTER TABLE "WorkSession" DROP COLUMN "label";

-- CreateIndex
CREATE UNIQUE INDEX "WorkItem_submissionId_key" ON "WorkItem"("submissionId");
CREATE INDEX "WorkItem_editorId_idx" ON "WorkItem"("editorId");
CREATE INDEX "WorkItem_status_idx" ON "WorkItem"("status");
CREATE INDEX "WorkSession_workItemId_idx" ON "WorkSession"("workItemId");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "Editor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "VideoSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
