import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, requireEditorSession } from "@/lib/auth";
import { updateSubmissionSchema } from "@/lib/validation";
import { calculatePriceCents } from "@/lib/pricing";
import type { Prisma } from "@/generated/prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  const data = parsed.data;

  const existing = await prisma.videoSubmission.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const update: Prisma.VideoSubmissionUpdateInput = {};
  if (data.status !== undefined) update.status = data.status;
  if (data.title !== undefined) update.title = data.title;
  if (data.clientOrProject !== undefined) update.clientOrProject = data.clientOrProject || null;
  if (data.videoLink !== undefined) update.videoLink = data.videoLink;
  if (data.notes !== undefined) update.notes = data.notes || null;

  if (data.durationMinutes !== undefined) {
    // Owner correcting a mistake — keep the originally snapshotted rate, but
    // use the style's current step-pricing increment for the recalculation.
    const style = await prisma.videoStyle.findUnique({ where: { id: existing.styleId } });
    const increment = style?.perMinuteIncrementCents ?? 0;
    update.durationMinutes = data.durationMinutes;
    update.calculatedPriceCents = calculatePriceCents(
      data.durationMinutes,
      existing.pricePerMinuteCents,
      increment
    );
  }

  const submission = await prisma.videoSubmission.update({
    where: { id },
    data: update,
  });

  return NextResponse.json({ submission });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const submission = await prisma.videoSubmission.findUnique({ where: { id } });

  if (!submission || submission.editorId !== session.editorId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (submission.status !== "submitted") {
    return NextResponse.json(
      { error: "Only videos still in 'submitted' status can be removed." },
      { status: 400 }
    );
  }

  await prisma.videoSubmission.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
