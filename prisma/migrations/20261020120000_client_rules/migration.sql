-- Client rules (the client's standing revision notes, as yes/no checks) and
-- brief checklists (QA turns a concept brief into a checklist for the editor).
-- Idempotent, so re-running it on a database that already has it is harmless.

ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "minLoudnessLufs" DOUBLE PRECISION NOT NULL DEFAULT -12;

CREATE TABLE IF NOT EXISTS "ClientRule" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "detail" TEXT,
    "source" TEXT,
    -- 'all', 'ugc' (AI UGC ads only) or 'broll' (B-roll videos only).
    "appliesTo" TEXT NOT NULL DEFAULT 'all',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientRule_active_idx" ON "ClientRule"("active");

-- Xanth's revisions of 19 Oct 2026 (ads 1.14, 1.15, 1.17) plus Ahmed's own notes of 20 Oct.
INSERT INTO "ClientRule" ("id", "category", "text", "detail", "source", "sortOrder", "updatedAt", "appliesTo") VALUES
('rule-xanth-same-mom', 'Story & casting', 'Anyone the story is about (mom, husband, kid, friend...) is the SAME person in every shot.', 'Every time she says "my mom" / "my husband" / "my son", show the one person you picked for that role. No random strangers swapped in halfway.', 'Xanth · ads 1.14 + 1.15 + 1.17 · 19 Oct', 10, CURRENT_TIMESTAMP, 'broll'),
('rule-xanth-believable-mom', 'Story & casting', 'That person believably fits the role next to the narrator.', 'A mom has a real age gap and a family resemblance (not a twin, not a stranger). A husband looks like her husband, a kid like her kid.', 'Xanth · ad 1.15 · 19 Oct', 20, CURRENT_TIMESTAMP, 'broll'),
('rule-xanth-detail-shots', 'Story & casting', 'Close-ups of hands, legs, the scale etc. match that same person.', 'If the person in the story has no tattoos, don''t cut to tattooed legs. Viewers notice and think "what am I watching?"', 'Xanth · ad 1.15 · 19 Oct', 30, CURRENT_TIMESTAMP, 'broll'),
('rule-xanth-audience-match', 'Story & casting', 'The people in the B-roll match who the ad is for.', 'An ad aimed at women shows women; an ad aimed at men shows men. B-roll must fit the concept.', 'Ahmed · 20 Oct', 35, CURRENT_TIMESTAMP, 'broll'),
('rule-xanth-ai-broll', 'Story & casting', 'Story B-roll is generated with AI from one consistent character, not stock clips forced to fit.', 'Make each person in the story from one reference image so they stay identical. Stock clips that only "kind of fit" break the story.', 'Xanth · ad 1.15 · 19 Oct', 40, CURRENT_TIMESTAMP, 'broll'),
('rule-xanth-broll-variety', 'B-roll', 'B-roll changes style and scene constantly. Not the same look all the way through.', 'Take inspiration from doctor pages: watch Dr. Berg and Dr. Gundry YouTube Shorts. Mix real stock, AI shots, claymation, close-ups, with scenes always changing.', 'Xanth · ad 1.17 · 19 Oct', 42, CURRENT_TIMESTAMP, 'broll'),
('rule-xanth-fast-cuts', 'Pacing', 'Original clips are sped up to 1.3x and trimmed tight. No pauses, nothing lingers.', 'Speed the talking/original clips to 1.3x, then cut every breath and dead moment. Ours were "super slow" next to Dr. Berg''s viral Shorts.', 'Ahmed + Xanth · ad 1.17 · 19 Oct', 44, CURRENT_TIMESTAMP, 'all'),
('rule-xanth-relevant-broll', 'B-roll', 'Every B-roll clip clearly shows what she is saying. No random filler.', 'e.g. a clip full of Chinese writing was "just weak". If it doesn''t match the line, swap it.', 'Xanth · ad 1.17 · 19 Oct', 46, CURRENT_TIMESTAMP, 'broll'),
('rule-xanth-appetizing-product', 'B-roll', 'Product and ingredient shots look attractive and safe to consume.', 'Never gloves, lab gear or hazardous-looking liquid ("looks like poison"). For milk thistle / cold-pressed: show the pretty plants being hand-crushed and pressed in a nice way.', 'Xanth · ad 1.17 · 19 Oct', 48, CURRENT_TIMESTAMP, 'broll'),
('rule-xanth-phone-real', 'Realism', 'Every scene looks like a real phone recording, not a movie.', 'Raw sunlight, natural imperfections: a slightly messy room, real skin, a bit of blur. No cinematic lighting or staring-off-into-the-distance shots. It should look like she filmed it herself.', 'Ahmed + Xanth · 19 Oct', 50, CURRENT_TIMESTAMP, 'all'),
('rule-xanth-no-ai-tells', 'Realism', 'No AI giveaways: clothes, hands and faces all look normal.', 'e.g. a shirt with no buttons or several openings, warped fingers, melted text. If it looks AI, regenerate it.', 'Xanth · 19 Oct', 60, CURRENT_TIMESTAMP, 'all'),
('rule-xanth-serious-face', 'Performance', 'The narrator looks AND sounds serious and concerned, not happy.', 'Almost every ad is about a problem. A smiling face or a cheerful voice makes her sound "paid to say this". She should sound real, with real emotion.', 'Xanth · ads 1.15 + 1.17 · 19 Oct', 70, CURRENT_TIMESTAMP, 'all'),
('rule-xanth-product-hold', 'Performance', 'She doesn''t hold the product on screen for a long stretch.', 'Show the product briefly, then cut away. Holding it up from the middle to the end looks like a paid ad.', 'Xanth · ad 1.17 · 19 Oct', 75, CURRENT_TIMESTAMP, 'all'),
('rule-xanth-max-volume', 'Audio', 'Volume is maxed out in CapCut (or whatever you edit in) before exporting.', 'So the ad is still loud when someone''s phone volume is low. Every ad in a batch should be equally loud. The audio check below measures this for you.', 'Xanth · 19 Oct', 80, CURRENT_TIMESTAMP, 'all'),
('rule-xanth-old-feedback', 'Before you submit', 'Every comment the client already left on this ad has been applied.', 'Re-read the notes on the last version. A note he has to give twice is a revision we pay for.', 'Xanth · 19 Oct', 90, CURRENT_TIMESTAMP, 'all')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "BriefChecklist" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "adType" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "checked" JSONB NOT NULL DEFAULT '[]',
    "editorId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefChecklist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BriefChecklist_code_key" ON "BriefChecklist"("code");
CREATE INDEX IF NOT EXISTS "BriefChecklist_editorId_idx" ON "BriefChecklist"("editorId");
CREATE INDEX IF NOT EXISTS "BriefChecklist_createdAt_idx" ON "BriefChecklist"("createdAt");

DO $$ BEGIN
    ALTER TABLE "BriefChecklist" ADD CONSTRAINT "BriefChecklist_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "Editor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
