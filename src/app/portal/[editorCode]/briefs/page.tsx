import { redirect } from "next/navigation";
import { getSession, isQaEditor } from "@/lib/auth";
import { PortalHeader } from "@/components/nav/portal-header";
import { BriefsClient } from "@/components/briefs/briefs-client";

/** QA builds brief checklists from the portal too — they're the ones assigning videos. */
export default async function QaBriefsPage({
  params,
}: {
  params: Promise<{ editorCode: string }>;
}) {
  const { editorCode } = await params;
  const session = await getSession();

  if (!session || session.role !== "editor" || session.editorCode !== editorCode.toLowerCase()) {
    redirect(`/portal/${encodeURIComponent(editorCode)}`);
  }
  if (!(await isQaEditor())) {
    redirect(`/portal/${session.editorCode}/dashboard`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <PortalHeader editorCode={session.editorCode} />
      <BriefsClient />
    </div>
  );
}
