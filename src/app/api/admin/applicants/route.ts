import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Owner only — applications carry personal contact details. */
export async function GET(request: NextRequest) {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const valid = status === "new" || status === "shortlisted" || status === "rejected";

  const applicants = await prisma.applicant.findMany({
    where: valid ? { status } : {},
    orderBy: [{ attentionPassed: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  const counts = await prisma.applicant.groupBy({ by: ["status"], _count: true });

  return NextResponse.json({
    applicants,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const status = body?.status;
  if (!id || !["new", "shortlisted", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const existing = await prisma.applicant.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
  }

  await prisma.applicant.update({ where: { id }, data: { status } });
  return NextResponse.json({ ok: true });
}
