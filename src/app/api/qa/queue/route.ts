import { NextRequest, NextResponse } from "next/server";
import { requireReviewerSession } from "@/lib/auth";
import { getCurrentBatch } from "@/lib/batch";
import { prisma } from "@/lib/prisma";

/**
 * Videos in a batch for QA to work through.
 *
 * A deliberately narrow select rather than reusing /api/submissions: that route
 * returns pricePerMinuteCents and calculatedPriceCents, and a QA editor has no
 * business seeing what colleagues are paid. Nothing here is a money field.
 */
export async function GET(request: NextRequest) {
  const reviewer = await requireReviewerSession();
  if (!reviewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const currentBatch = await getCurrentBatch();
  const batchParam = request.nextUrl.searchParams.get("batch");
  const batchNumber = batchParam === "all" ? null : Number(batchParam || currentBatch);
  if (batchNumber != null && !Number.isInteger(batchNumber)) {
    return NextResponse.json({ error: "Invalid batch number." }, { status: 400 });
  }

  const items = await prisma.videoSubmission.findMany({
    where: {
      ...(batchNumber != null ? { batchNumber } : {}),
      // QA never reviews their own work.
      ...(reviewer.reviewerEditorId ? { editorId: { not: reviewer.reviewerEditorId } } : {}),
    },
    orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      styleName: true,
      videoLink: true,
      durationMinutes: true,
      status: true,
      batchNumber: true,
      submittedAt: true,
      editor: { select: { name: true } },
      // Severities, so a row can show what's already been counted against it.
      revisions: { select: { severity: true, reason: true } },
    },
  });

  return NextResponse.json({
    batchNumber,
    currentBatch,
    batches: Array.from({ length: currentBatch }, (_, i) => currentBatch - i),
    items: items.map((i) => {
      const mine = i.revisions.filter((r) => r.reason === "editor_error");
      return {
        id: i.id,
        title: i.title,
        styleName: i.styleName,
        videoLink: i.videoLink,
        durationMinutes: i.durationMinutes,
        status: i.status,
        batchNumber: i.batchNumber,
        submittedAt: i.submittedAt,
        editor: i.editor,
        revisions: {
          minor: mine.filter((r) => r.severity === 1).length,
          moderate: mine.filter((r) => r.severity === 2).length,
          major: mine.filter((r) => r.severity === 3).length,
          briefChanges: i.revisions.length - mine.length,
        },
      };
    }),
  });
}
