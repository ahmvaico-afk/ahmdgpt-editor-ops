import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalHeader } from "@/components/nav/portal-header";
import { EditorInvoiceClient } from "@/components/portal/editor-invoice-client";

export default async function EditorInvoicePage({
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
      <EditorInvoiceClient editorName={session.name} />
    </div>
  );
}
