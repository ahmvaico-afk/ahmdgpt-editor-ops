-- Public hiring form shared on stories. Not linked to Editor: most applicants
-- never become one, and an application shouldn't create a login.

-- CreateEnum
CREATE TYPE "ApplicantStatus" AS ENUM ('new', 'shortlisted', 'rejected');

-- CreateTable
CREATE TABLE "Applicant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "city" TEXT,
    "hasAiAdsExperience" BOOLEAN NOT NULL,
    "portfolio" TEXT,
    "software" TEXT NOT NULL,
    "aiTools" TEXT,
    "ownsComputer" BOOLEAN NOT NULL,
    "computerSpecs" TEXT,
    "ownsPhone" BOOLEAN NOT NULL,
    "hoursPerDay" TEXT NOT NULL,
    "handlesFeedback" BOOLEAN NOT NULL,
    "turnaround" TEXT,
    "expectedPayPkr" TEXT,
    "whyYou" TEXT,
    "attentionAnswer" TEXT NOT NULL,
    "attentionPassed" BOOLEAN NOT NULL DEFAULT false,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Applicant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Applicant_status_idx" ON "Applicant"("status");
CREATE INDEX "Applicant_createdAt_idx" ON "Applicant"("createdAt");
