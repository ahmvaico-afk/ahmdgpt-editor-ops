import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEditorSession } from "@/lib/auth";
import { summarize } from "@/lib/briefs";

/** The signed-in editor's own brief checklists, newest first. */
export async function GET() {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rows = await prisma.briefChecklist.findMany({
    where: { editorId: session.editorId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({
    briefs: rows.map((r) => {
      const { done, total } = summarize(r);
      return { code: r.code, title: r.title, adType: r.adType, createdAt: r.createdAt, done, total };
    }),
  });
}
