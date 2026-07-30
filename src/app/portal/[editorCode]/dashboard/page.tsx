import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalHeader } from "@/components/nav/portal-header";
import { DashboardClient } from "@/components/portal/dashboard-client";

export default async function EditorDashboardPage({
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
      <DashboardClient editorName={session.name} />
    </div>
  );
}
