import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const editors = await prisma.editor.findMany({ orderBy: { name: "asc" } });

  const totals = [];
  for (const editor of editors) {
    const agg = await prisma.videoSubmission.aggregate({
      where: { editorId: editor.id },
      _count: true,
      _sum: { calculatedPriceCents: true, durationMinutes: true },
    });
    totals.push({
      editorId: editor.id,
      name: editor.name,
      editorCode: editor.editorCode,
      active: editor.active,
      videoCount: agg._count,
      totalDurationMinutes: agg._sum.durationMinutes ?? 0,
      totalCents: agg._sum.calculatedPriceCents ?? 0,
    });
  }

  return NextResponse.json({ totals });
}
