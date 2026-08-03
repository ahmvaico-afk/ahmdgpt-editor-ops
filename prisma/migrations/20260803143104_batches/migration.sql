-- Batch grouping for submissions, plus a singleton settings row to track the current batch.
ALTER TABLE "VideoSubmission" ADD COLUMN "batchNumber" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "VideoSubmission_batchNumber_idx" ON "VideoSubmission"("batchNumber");

CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "currentBatch" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
