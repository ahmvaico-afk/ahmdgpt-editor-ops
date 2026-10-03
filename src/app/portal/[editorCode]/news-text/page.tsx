import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PortalHeader } from "@/components/nav/portal-header";

/*
 * News Text Maker is a separate Vite app (H:\CLAUDE CODE\news-text-maker) built
 * into public/tools/news-text-maker via `npm run build:portal` there, and shown
 * here full-height. src/proxy.ts keeps /tools/* behind a session.
 */
export default async function NewsTextPage({
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
    <div className="flex h-dvh flex-col">
      <PortalHeader editorCode={session.editorCode} />
      <iframe
        src="/tools/news-text-maker/index.html"
        title="News Text Maker"
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
