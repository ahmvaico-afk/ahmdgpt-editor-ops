import { redirect } from "next/navigation";
import { getSession, requireQaEditorSession } from "@/lib/auth";
import { PortalHeader } from "@/components/nav/portal-header";

/*
 * Swipe Lab: ranked competitor winning ads with remake prompts. QA editors only.
 * The page and images live in assets/swipe-lab and are served through
 * /api/swipe-lab/files, which also checks QA. "Made" ticks stay in the QA
 * person's browser (localStorage), so there is no database table for them.
 */
export default async function SwipeLabPage({
  params,
}: {
  params: Promise<{ editorCode: string }>;
}) {
  const { editorCode } = await params;
  const session = await getSession();

  if (!session || session.role !== "editor" || session.editorCode !== editorCode.toLowerCase()) {
    redirect(`/portal/${encodeURIComponent(editorCode)}`);
  }
  // Checked against the database, not the token, so revoking QA takes effect at once.
  if (!(await requireQaEditorSession())) {
    redirect(`/portal/${encodeURIComponent(editorCode)}/dashboard`);
  }

  return (
    <div className="flex h-dvh flex-col">
      <PortalHeader editorCode={session.editorCode} />
      <iframe
        src="/api/swipe-lab/files/index.html"
        title="Swipe Lab"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
