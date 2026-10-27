import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalHeader } from "@/components/nav/portal-header";
import { AdResizer } from "@/components/portal/ad-resizer-loader";

/*
 * 9:16 → 16:9 / 4:5 / 1:1 with blurred sides. All the video work happens in the
 * editor's browser (src/lib/ad-resize), so nothing is uploaded to the server.
 */
export default async function AdResizerPage({
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
      <AdResizer />
    </div>
  );
}
