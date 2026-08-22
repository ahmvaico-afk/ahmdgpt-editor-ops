-- More screening, and automatic sorting of the ones who clearly didn't read.
-- Deliberately a boolean rather than a new ApplicantStatus value: being auto
-- filtered is orthogonal to the owner's own new/shortlisted/rejected decision.

ALTER TABLE "Applicant" ADD COLUMN "mathAnswer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Applicant" ADD COLUMN "hoursAnswer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Applicant" ADD COLUMN "scenarioAnswer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Applicant" ADD COLUMN "checksPassed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Applicant" ADD COLUMN "secondsTaken" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Applicant" ADD COLUMN "autoFiltered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Applicant" ADD COLUMN "filterReason" TEXT;

CREATE INDEX "Applicant_autoFiltered_idx" ON "Applicant"("autoFiltered");
