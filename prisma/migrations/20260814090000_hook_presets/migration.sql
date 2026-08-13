-- CreateTable
CREATE TABLE "HookPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "ownerEditorId" TEXT,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HookPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HookPreset_ownerEditorId_idx" ON "HookPreset"("ownerEditorId");

-- AddForeignKey
ALTER TABLE "HookPreset" ADD CONSTRAINT "HookPreset_ownerEditorId_fkey" FOREIGN KEY ("ownerEditorId") REFERENCES "Editor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
