import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma/client";
import type { SubmissionStatus } from "@/lib/types";

// Only these two transitions are exposed in bulk — mirrors the single-item
// action buttons (submitted -> approved -> paid). Rejecting/reconsidering in
// bulk isn't offered; those stay deliberate, one at a time.
const FROM_STATUS: Partial<Record<SubmissionStatus, SubmissionStatus>> = {
  approved: "submitted",
  paid: "approved",
};

export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const toStatus: SubmissionStatus | undefined = body?.status;
  const fromStatus = toStatus ? FROM_STATUS[toStatus] : undefined;
  if (!fromStatus) {
    return NextResponse.json({ error: "Invalid target status." }, { status: 400 });
  }

  const where: Prisma.VideoSubmissionWhereInput = { status: fromStatus };
  if (body.batch) where.batchNumber = Number(body.batch);
  if (body.editorId) where.editorId = body.editorId;
  if (body.styleId) where.styleId = body.styleId;

  const result = await prisma.videoSubmission.updateMany({
    where,
    data: { status: toStatus },
  });

  return NextResponse.json({ updated: result.count });
}
