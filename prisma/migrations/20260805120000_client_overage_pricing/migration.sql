-- Client invoice pricing: support a flat base price with either stepped-tier
-- (with grace buffer) or continuous-proportional overage, in addition to the
-- existing plain per-minute rate.
ALTER TABLE "VideoStyle" ADD COLUMN "clientBaseSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VideoStyle" ADD COLUMN "clientOverageUnitSeconds" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "VideoStyle" ADD COLUMN "clientOverageGraceSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VideoStyle" ADD COLUMN "clientOverageProportional" BOOLEAN NOT NULL DEFAULT false;
