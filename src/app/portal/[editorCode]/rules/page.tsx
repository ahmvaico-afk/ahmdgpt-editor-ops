import { redirect } from "next/navigation";
import { getSession, isQaEditor } from "@/lib/auth";
import { PortalHeader } from "@/components/nav/portal-header";
import { EditorRulesClient } from "@/components/rules/editor-rules-client";
import { RulesAdminClient } from "@/components/rules/rules-admin-client";

export default async function EditorRulesPage({
  params,
}: {
  params: Promise<{ editorCode: string }>;
}) {
  const { editorCode } = await params;
  const session = await getSession();

  if (!session || session.role !== "editor" || session.editorCode !== editorCode.toLowerCase()) {
    redirect(`/portal/${encodeURIComponent(editorCode)}`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <PortalHeader editorCode={session.editorCode} />
      {/* QA hears the client's revisions too, so they keep the rulebook. */}
      {(await isQaEditor()) ? <RulesAdminClient /> : <EditorRulesClient />}
    </div>
  );
}
