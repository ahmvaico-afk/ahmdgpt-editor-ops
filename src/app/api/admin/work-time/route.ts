import { NextRequest, NextResponse } from "next/server";
import { requireReviewerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_SESSION_HOURS } from "@/lib/meters";
import { approveWorkTimeSchema } from "@/lib/validation";

/**
 * Finished work and the time logged against it, for QA to sign off.
 *
 * Open to owner and QA alike — reviewing work is QA's job, and this carries no
 * rates or payouts.
 */
export async function GET(request: NextRequest) {
  const reviewer = await requireReviewerSession();
  if (!reviewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const pendingOnly = request.nextUrl.searchParams.get("pending") !== "false";
  const now = Date.now();

  const items = await prisma.workItem.findMany({
    where: {
      status: "finished",
      ...(pendingOnly ? { timeApprovedAt: null } : {}),
      // A QA editor never sees their own work here — they can't sign off their
      // own hours, so showing them would only invite the attempt.
      ...(reviewer.reviewerEditorId ? { editorId: { not: reviewer.reviewerEditorId } } : {}),
    },
    orderBy: { finishedAt: "desc" },
    take: 100,
    include: {
      editor: { select: { name: true } },
      submission: { select: { id: true, title: true, durationMinutes: true, status: true } },
      sessions: { select: { startedAt: true, endedAt: true } },
    },
  });

  return NextResponse.json({
    items: items.map((i) => {
      let ms = 0;
      let capped = 0;
      for (const s of i.sessions) {
        const end = s.endedAt ? s.endedAt.getTime() : now;
        const span = Math.max(0, end - s.startedAt.getTime());
        if (span >= MAX_SESSION_HOURS * 3600_000) capped += 1;
        ms += span;
      }
      const minutes = Math.round(ms / 60000);
      const duration = i.submission?.durationMinutes ?? null;
      return {
        id: i.id,
        label: i.label,
        editorName: i.editor.name,
        minutes,
        spans: i.sessions.length,
        cappedSpans: capped,
        approved: i.timeApprovedAt != null,
        finishedAt: i.finishedAt,
        submission: i.submission,
        // The number QA is really judging: does that pace look believable?
        minutesPerFinishedMinute: duration && duration > 0 ? minutes / duration : null,
      };
    }),
  });
}

/** QA (or the owner) signs the logged time off, or withdraws that sign-off. */
export async function PATCH(request: NextRequest) {
  const reviewer = await requireReviewerSession();
  if (!reviewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const parsed = approveWorkTimeSchema.safeParse(body);
  if (!id || !parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const item = await prisma.workItem.findUnique({
    where: { id },
    select: { id: true, editorId: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Work not found." }, { status: 404 });
  }
  if (reviewer.reviewerEditorId && reviewer.reviewerEditorId === item.editorId) {
    return NextResponse.json(
      { error: "You can't approve your own logged time." },
      { status: 403 },
    );
  }

  await prisma.workItem.update({
    where: { id },
    data: { timeApprovedAt: parsed.data.approved ? new Date() : null },
  });
  return NextResponse.json({ ok: true, approved: parsed.data.approved });
}
