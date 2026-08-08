import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const batchParam = request.nextUrl.searchParams.get("batch");
  const batchNumber = batchParam ? Number(batchParam) : null;
  if (batchParam && !Number.isInteger(batchNumber)) {
    return NextResponse.json({ error: "Invalid batch number." }, { status: 400 });
  }

  const editors = await prisma.editor.findMany({ orderBy: { name: "asc" } });

  const totals = [];
  for (const editor of editors) {
    const agg = await prisma.videoSubmission.aggregate({
      where: {
        editorId: editor.id,
        ...(batchNumber != null ? { batchNumber } : {}),
      },
      _count: true,
      _sum: { calculatedPriceCents: true, durationMinutes: true },
    });
    // Editors with nothing in the selected batch are dropped rather than shown
    // as zero rows — this view is "what do I owe for this batch".
    if (batchNumber != null && agg._count === 0) continue;
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

  const grandTotalCents = totals.reduce((sum, t) => sum + t.totalCents, 0);
  const grandVideoCount = totals.reduce((sum, t) => sum + t.videoCount, 0);

  return NextResponse.json({ totals, grandTotalCents, grandVideoCount });
}
