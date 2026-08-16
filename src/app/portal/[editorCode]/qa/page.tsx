import { redirect } from "next/navigation";
import { getSession, isQaEditor } from "@/lib/auth";
import { PortalHeader } from "@/components/nav/portal-header";
import { QaClient } from "@/components/portal/qa-client";

export default async function QaPage({
  params,
}: {
  params: Promise<{ editorCode: string }>;
}) {
  const { editorCode } = await params;
  const session = await getSession();

  if (!session || session.role !== "editor" || session.editorCode !== editorCode.toLowerCase()) {
    redirect(`/portal/${encodeURIComponent(editorCode)}`);
  }
  // Checked against the database, not the token, so revoking QA takes effect
  // immediately rather than when their session eventually expires.
  if (!(await isQaEditor())) {
    redirect(`/portal/${encodeURIComponent(editorCode)}/dashboard`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <PortalHeader editorCode={session.editorCode} />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text">QA Review</h1>
          <p className="mt-1 text-sm text-muted">
            Approve videos, log revisions, and sign off logged time. Your own work never appears
            here.
          </p>
        </div>
        <QaClient />
      </div>
    </div>
  );
}
