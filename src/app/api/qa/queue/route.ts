import { NextResponse } from "next/server";
import { requireReviewerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Videos waiting on review.
 *
 * A deliberately narrow select rather than reusing /api/submissions: that route
 * returns pricePerMinuteCents and calculatedPriceCents, and a QA editor has no
 * business seeing what colleagues are paid. Nothing here is a money field.
 */
export async function GET() {
  const reviewer = await requireReviewerSession();
  if (!reviewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const items = await prisma.videoSubmission.findMany({
    where: {
      status: "submitted",
      // QA never reviews their own work.
      ...(reviewer.reviewerEditorId ? { editorId: { not: reviewer.reviewerEditorId } } : {}),
    },
    orderBy: { submittedAt: "asc" },
    take: 100,
    select: {
      id: true,
      title: true,
      styleName: true,
      clientOrProject: true,
      videoLink: true,
      durationMinutes: true,
      status: true,
      batchNumber: true,
      submittedAt: true,
      notes: true,
      editor: { select: { name: true } },
      _count: { select: { revisions: true } },
    },
  });

  return NextResponse.json({ items });
}
