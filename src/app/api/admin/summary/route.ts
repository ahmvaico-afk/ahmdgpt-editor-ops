import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/auth";

export async function GET() {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Sequential, not Promise.all: concurrent queries through the pg driver
  // adapter's shared pool can corrupt prepared statements under load.
  const videosThisWeek = await prisma.videoSubmission.count({
    where: { submittedAt: { gte: startOfWeek } },
  });
  const videosThisMonth = await prisma.videoSubmission.count({
    where: { submittedAt: { gte: startOfMonth } },
  });
  const owed = await prisma.videoSubmission.aggregate({
    where: { status: { in: ["submitted", "approved"] } },
    _sum: { calculatedPriceCents: true },
    _count: true,
  });
  const paidOut = await prisma.videoSubmission.aggregate({
    where: { status: "paid" },
    _sum: { calculatedPriceCents: true },
    _count: true,
  });
  const byStyle = await prisma.videoSubmission.groupBy({
    by: ["styleName"],
    _sum: { calculatedPriceCents: true },
    _count: true,
    orderBy: { _count: { styleName: "desc" } },
  });
  const topEditors = await prisma.videoSubmission.groupBy({
    by: ["editorId"],
    _count: true,
    orderBy: { _count: { editorId: "desc" } },
    take: 5,
  });

  const editorIds = topEditors.map((t) => t.editorId);
  const editors = await prisma.editor.findMany({
    where: { id: { in: editorIds } },
    select: { id: true, name: true, editorCode: true },
  });
  const editorMap = new Map(editors.map((e) => [e.id, e]));

  return NextResponse.json({
    videosThisWeek,
    videosThisMonth,
    owed: { totalCents: owed._sum.calculatedPriceCents ?? 0, count: owed._count },
    paidOut: { totalCents: paidOut._sum.calculatedPriceCents ?? 0, count: paidOut._count },
    byStyle: byStyle.map((s) => ({
      styleName: s.styleName,
      totalCents: s._sum.calculatedPriceCents ?? 0,
      count: s._count,
    })),
    topEditors: topEditors.map((t) => ({
      editor: editorMap.get(t.editorId) ?? null,
      count: t._count,
    })),
  });
}
