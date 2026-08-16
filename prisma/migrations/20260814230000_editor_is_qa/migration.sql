-- QA is a hat an existing editor wears, promoted by the owner from the Editors
-- tab, rather than a separate account to hand out.
ALTER TABLE "Editor" ADD COLUMN "isQa" BOOLEAN NOT NULL DEFAULT false;
