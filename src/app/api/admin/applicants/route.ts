import { NextRequest, NextResponse } from "next/server";
import { requireOwnerSession } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { countryFromPhone } from "@/lib/screening";

/** Owner only — applications carry personal contact details. */
export async function GET(request: NextRequest) {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const tab = params.get("status");
  const country = params.get("country");

  // "filtered" is its own view, and the other tabs exclude those rows — the
  // whole point is that the main pile stays clean without deleting anyone.
  const statusWhere: Prisma.ApplicantWhereInput =
    tab === "filtered"
      ? { autoFiltered: true }
      : tab === "new" || tab === "shortlisted" || tab === "rejected"
        ? { status: tab, autoFiltered: false }
        : { autoFiltered: false };

  // Country isn't stored — it's read off the WhatsApp number — so the filter
  // and all the counts happen here rather than in the query. That costs one
  // cheap read of every row's number and status, which at this size is a few
  // hundred short strings, and it buys a split that works on applications
  // that arrived long before the two campaigns were separated.
  //
  // Sequential, not Promise.all: concurrent queries through the pg driver
  // adapter's shared pool can corrupt prepared statements.
  const everyone = await prisma.applicant.findMany({
    select: { whatsapp: true, status: true, autoFiltered: true },
  });

  const inCountry = (whatsapp: string) =>
    country === null || countryFromPhone(whatsapp) === country;

  // Each tab's number describes what that tab would actually show, so the
  // counts still add up once a country is selected.
  const counts: Record<string, number> = { filtered: 0 };
  for (const a of everyone) {
    if (!inCountry(a.whatsapp)) continue;
    if (a.autoFiltered) counts.filtered += 1;
    else counts[a.status] = (counts[a.status] ?? 0) + 1;
  }

  // Scoped to the open status tab but deliberately not to the country: this is
  // what fills the country tabs, and narrowing it by country would leave only
  // the one already selected, with no way back.
  const countryTally = new Map<string, number>();
  for (const a of everyone) {
    const matchesTab = tab === "filtered" ? a.autoFiltered : !a.autoFiltered;
    const matchesStatus =
      tab === "new" || tab === "shortlisted" || tab === "rejected" ? a.status === tab : true;
    if (!matchesTab || !matchesStatus) continue;
    const c = countryFromPhone(a.whatsapp);
    countryTally.set(c, (countryTally.get(c) ?? 0) + 1);
  }

  // Generous enough to hold every application in a tab at the current rate of
  // arrival, so the country filter never has to work off a truncated page.
  const rows = await prisma.applicant.findMany({
    where: statusWhere,
    orderBy: [{ attentionPassed: "desc" }, { createdAt: "desc" }],
    take: 2000,
  });

  const applicants = rows
    .filter((a) => inCountry(a.whatsapp))
    .map((a) => ({ ...a, country: countryFromPhone(a.whatsapp) }));

  // Grouped by the exact page, not just the channel — "Facebook group: 9" is
  // useless when the question is which of the nine groups to post in again.
  const sourceTally = new Map<string, { source: string; detail: string | null; count: number }>();
  for (const a of rows) {
    if (a.autoFiltered || a.source === "" || !inCountry(a.whatsapp)) continue;
    const key = `${a.source}\u0000${a.sourceDetail ?? ""}`;
    const seen = sourceTally.get(key);
    if (seen) seen.count += 1;
    else sourceTally.set(key, { source: a.source, detail: a.sourceDetail, count: 1 });
  }

  return NextResponse.json({
    applicants,
    counts,
    countries: [...countryTally.entries()]
      .map(([c, count]) => ({ country: c, count }))
      .sort((a, b) => b.count - a.count),
    sources: [...sourceTally.values()].sort((a, b) => b.count - a.count),
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

  const updated = await prisma.applicant.updateMany({ where: { id }, data: { status } });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Applicant not found." }, { status: 404 });
  }
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
