-- Client-facing billing rates for invoices, separate from the editor payout rate.
ALTER TABLE "VideoStyle" ADD COLUMN "clientRatePerMinuteCents" INTEGER;
ALTER TABLE "VideoStyle" ADD COLUMN "clientPerMinuteIncrementCents" INTEGER NOT NULL DEFAULT 0;
