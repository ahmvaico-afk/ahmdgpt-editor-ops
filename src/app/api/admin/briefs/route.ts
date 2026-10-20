import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireReviewerSession } from "@/lib/auth";
import { createBriefSchema } from "@/lib/validation";
import { newShareCode, summarize } from "@/lib/briefs";

/** Recent brief checklists with how far each editor has got, plus who can be assigned. */
export async function GET() {
  if (!(await requireReviewerSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Sequential, not Promise.all — see the note in /api/submissions.
  const rows = await prisma.briefChecklist.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { editor: { select: { name: true } } },
  });
  const editors = await prisma.editor.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    editors,
    briefs: rows.map((r) => {
      const { done, total } = summarize(r);
      return {
        id: r.id,
        code: r.code,
        title: r.title,
        adType: r.adType,
        editorName: r.editor?.name ?? null,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        done,
        total,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  if (!(await requireReviewerSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const session = await getSession();

  const body = await request.json().catch(() => null);
  const parsed = createBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Check the brief and the list." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const row = await prisma.briefChecklist.create({
    data: {
      code: newShareCode(),
      title: data.title,
      adType: data.adType,
      brief: data.brief,
      items: data.items,
      editorId: data.editorId || null,
      createdBy: session?.name ?? null,
    },
  });
  return NextResponse.json({ id: row.id, code: row.code }, { status: 201 });
}
