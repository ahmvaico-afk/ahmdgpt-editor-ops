import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEditorSession } from "@/lib/auth";

export async function GET() {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [all, thisMonth, byStatus] = await Promise.all([
    prisma.videoSubmission.aggregate({
      where: { editorId: session.editorId },
      _sum: { calculatedPriceCents: true },
      _count: true,
    }),
    prisma.videoSubmission.aggregate({
      where: { editorId: session.editorId, submittedAt: { gte: startOfMonth } },
      _sum: { calculatedPriceCents: true },
      _count: true,
    }),
    prisma.videoSubmission.groupBy({
      by: ["status"],
      where: { editorId: session.editorId },
      _sum: { calculatedPriceCents: true },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    allTime: { totalCents: all._sum.calculatedPriceCents ?? 0, count: all._count },
    thisMonth: { totalCents: thisMonth._sum.calculatedPriceCents ?? 0, count: thisMonth._count },
    byStatus: byStatus.map((s) => ({
      status: s.status,
      totalCents: s._sum.calculatedPriceCents ?? 0,
      count: s._count,
    })),
  });
}
