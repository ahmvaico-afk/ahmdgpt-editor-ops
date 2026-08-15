import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalHeader } from "@/components/nav/portal-header";
import { MetersClient } from "@/components/meters-client";

export default async function EditorMetersPage({
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
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text">Meters</h1>
          <p className="mt-1 text-sm text-muted">
            Quality score for every editor. Fewer revisions and faster turnaround move you up.
          </p>
        </div>
        <MetersClient />
      </div>
    </div>
  );
}
