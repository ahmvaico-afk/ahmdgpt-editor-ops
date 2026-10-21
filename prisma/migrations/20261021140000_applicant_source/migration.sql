-- Where applicants saw the post, so it's clear which groups and posts are
-- actually worth the effort.
--
-- Additive only, with defaults: there are live applications in this table and
-- none of them answered this question.

ALTER TABLE "Applicant" ADD COLUMN "source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Applicant" ADD COLUMN "sourceDetail" TEXT;
ALTER TABLE "Applicant" ADD COLUMN "sourceTag" TEXT;
