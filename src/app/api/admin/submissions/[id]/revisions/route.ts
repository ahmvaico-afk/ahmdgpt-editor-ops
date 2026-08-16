import { NextRequest, NextResponse } from "next/server";
import { requireReviewerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRevisionSchema } from "@/lib/validation";

const SELF_REVIEW = "You can't log revisions on your own video.";

/**
 * Revisions are reviewer-only in both directions: editors see the ones logged
 * against their own work through the meters, but only the owner or a QA editor
 * creates or removes them — and a QA editor never on their own work.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const reviewer = await requireReviewerSession();
  if (!reviewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createRevisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a severity and a reason." }, { status: 400 });
  }

  const submission = await prisma.videoSubmission.findUnique({
    where: { id },
    select: { id: true, editorId: true },
  });
  if (!submission) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }
  if (reviewer.reviewerEditorId && reviewer.reviewerEditorId === submission.editorId) {
    return NextResponse.json({ error: SELF_REVIEW }, { status: 403 });
  }

  // One row per revision, so severity still scores individually and any single
  // one can be removed later if QA over-counted.
  const { counts, reason, note } = parsed.data;
  const rows = [
    ...Array<number>(counts.minor).fill(1),
    ...Array<number>(counts.moderate).fill(2),
    ...Array<number>(counts.major).fill(3),
  ].map((severity) => ({
    submissionId: submission.id,
    severity,
    reason,
    note: note || null,
  }));

  await prisma.revision.createMany({ data: rows });
  return NextResponse.json({ created: rows.length }, { status: 201 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const reviewer = await requireReviewerSession();
  if (!reviewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  const revisions = await prisma.revision.findMany({
    where: { submissionId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ revisions });
}

/** Undo a mis-logged revision. `?revisionId=` identifies which. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const reviewer = await requireReviewerSession();
  if (!reviewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  const revisionId = request.nextUrl.searchParams.get("revisionId");
  if (!revisionId) {
    return NextResponse.json({ error: "Which revision?" }, { status: 400 });
  }
  const owning = await prisma.videoSubmission.findUnique({
    where: { id },
    select: { editorId: true },
  });
  if (reviewer.reviewerEditorId && reviewer.reviewerEditorId === owning?.editorId) {
    return NextResponse.json({ error: SELF_REVIEW }, { status: 403 });
  }
  // Matched on the submission too, so an id from another video can't be used.
  const result = await prisma.revision.deleteMany({
    where: { id: revisionId, submissionId: id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Revision not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
