-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('submitted', 'approved', 'paid', 'rejected');

-- CreateTable
CREATE TABLE "Editor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "editorCode" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Editor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loginCode" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoStyle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCustomPricing" BOOLEAN NOT NULL DEFAULT false,
    "ratePerMinuteCents" INTEGER,
    "perMinuteIncrementCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoStyle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoSubmission" (
    "id" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "styleName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientOrProject" TEXT,
    "videoLink" TEXT NOT NULL,
    "durationMinutes" DOUBLE PRECISION NOT NULL,
    "pricePerMinuteCents" INTEGER NOT NULL,
    "calculatedPriceCents" INTEGER NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "VideoSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Editor_editorCode_key" ON "Editor"("editorCode");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_loginCode_key" ON "AdminUser"("loginCode");

-- CreateIndex
CREATE INDEX "VideoSubmission_editorId_idx" ON "VideoSubmission"("editorId");

-- CreateIndex
CREATE INDEX "VideoSubmission_styleId_idx" ON "VideoSubmission"("styleId");

-- CreateIndex
CREATE INDEX "VideoSubmission_status_idx" ON "VideoSubmission"("status");

-- CreateIndex
CREATE INDEX "VideoSubmission_submittedAt_idx" ON "VideoSubmission"("submittedAt");

-- AddForeignKey
ALTER TABLE "VideoSubmission" ADD CONSTRAINT "VideoSubmission_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "Editor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoSubmission" ADD CONSTRAINT "VideoSubmission_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "VideoStyle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

