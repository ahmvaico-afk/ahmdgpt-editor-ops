import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Owner only — applications carry personal contact details. */
export async function GET(request: NextRequest) {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const tab = request.nextUrl.searchParams.get("status");

  // "filtered" is its own view, and the other tabs exclude those rows — the
  // whole point is that the main pile stays clean without deleting anyone.
  const where: Prisma.ApplicantWhereInput =
    tab === "filtered"
      ? { autoFiltered: true }
      : tab === "new" || tab === "shortlisted" || tab === "rejected"
        ? { status: tab, autoFiltered: false }
        : { autoFiltered: false };

  const applicants = await prisma.applicant.findMany({
    where,
    orderBy: [{ attentionPassed: "desc" }, { createdAt: "desc" }],
    take: 300,
  });

  // Sequential, not Promise.all: concurrent queries through the pg driver
  // adapter's shared pool can corrupt prepared statements under load.
  const counts = await prisma.applicant.groupBy({
    by: ["status"],
    where: { autoFiltered: false },
    _count: true,
  });
  const filtered = await prisma.applicant.count({ where: { autoFiltered: true } });

  // Across everyone worth reading, not the current tab — the question is which
  // channels send good people, so the filtered-out pile would only muddy it.
  const bySource = await prisma.applicant.groupBy({
    by: ["source"],
    where: { autoFiltered: false },
    _count: true,
  });

  return NextResponse.json({
    applicants,
    counts: {
      ...Object.fromEntries(counts.map((c) => [c.status, c._count])),
      filtered,
    },
    sources: bySource
      .filter((s) => s.source !== "")
      .map((s) => ({ source: s.source, count: s._count }))
      .sort((a, b) => b.count - a.count),
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

/**
 * Permanently removes an application. There's no soft-delete here on purpose —
 * "rejected" and "filtered out" already cover keeping someone around, so
 * reaching for this means the owner genuinely wants it gone.
 */
export async function DELETE(request: NextRequest) {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Which applicant?" }, { status: 400 });
  }

  const result = await prisma.applicant.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
