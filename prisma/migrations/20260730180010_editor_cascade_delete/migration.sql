-- Deleting an Editor now cascades to delete their VideoSubmission rows too.
ALTER TABLE "VideoSubmission" DROP CONSTRAINT "VideoSubmission_editorId_fkey";
ALTER TABLE "VideoSubmission" ADD CONSTRAINT "VideoSubmission_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "Editor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
