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

  // Sequential, not Promise.all: concurrent queries through the pg driver
  // adapter's shared pool can corrupt prepared statements under load.
  const all = await prisma.videoSubmission.aggregate({
    where: { editorId: session.editorId },
    _sum: { calculatedPriceCents: true },
    _count: true,
  });
  const thisMonth = await prisma.videoSubmission.aggregate({
    where: { editorId: session.editorId, submittedAt: { gte: startOfMonth } },
    _sum: { calculatedPriceCents: true },
    _count: true,
  });
  const byStatus = await prisma.videoSubmission.groupBy({
    by: ["status"],
    where: { editorId: session.editorId },
    _sum: { calculatedPriceCents: true },
    _count: true,
  });

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
