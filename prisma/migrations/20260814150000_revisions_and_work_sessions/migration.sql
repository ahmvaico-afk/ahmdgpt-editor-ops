-- CreateEnum
CREATE TYPE "RevisionReason" AS ENUM ('editor_error', 'brief_change');

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "reason" "RevisionReason" NOT NULL DEFAULT 'editor_error',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSession" (
    "id" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Revision_submissionId_idx" ON "Revision"("submissionId");

-- CreateIndex
CREATE INDEX "WorkSession_editorId_idx" ON "WorkSession"("editorId");

-- CreateIndex
CREATE INDEX "WorkSession_submissionId_idx" ON "WorkSession"("submissionId");

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "VideoSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "Editor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "VideoSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
