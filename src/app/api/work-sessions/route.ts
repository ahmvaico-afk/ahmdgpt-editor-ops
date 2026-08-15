import { NextRequest, NextResponse } from "next/server";
import { requireEditorSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenSession } from "@/lib/meters";
import { startWorkSessionSchema } from "@/lib/validation";

/** The editor's running timer, or null. Polled by the dashboard indicator. */
export async function GET() {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const open = await getOpenSession(session.editorId);
  return NextResponse.json({
    session: open
      ? {
          id: open.id,
          submissionId: open.submissionId,
          title: open.submission.title,
          startedAt: open.startedAt,
        }
      : null,
  });
}

/** Starts the clock on one of the editor's own videos. */
export async function POST(request: NextRequest) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = startWorkSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a video first." }, { status: 400 });
  }

  // Scoped by editorId as well as id, so an editor can't start a timer against
  // someone else's video.
  const submission = await prisma.videoSubmission.findFirst({
    where: { id: parsed.data.submissionId, editorId: session.editorId },
    select: { id: true },
  });
  if (!submission) {
    return NextResponse.json({ error: "That video isn't yours." }, { status: 404 });
  }

  // One clock at a time. Starting a new video closes whatever was running, so
  // an editor can switch tasks without stranding a session open forever.
  await prisma.workSession.updateMany({
    where: { editorId: session.editorId, endedAt: null },
    data: { endedAt: new Date() },
  });

  const created = await prisma.workSession.create({
    data: { editorId: session.editorId, submissionId: submission.id },
  });
  return NextResponse.json({ session: { id: created.id, startedAt: created.startedAt } }, { status: 201 });
}

/** Stops the clock. Called when the editor finishes a stretch of work. */
export async function DELETE() {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const result = await prisma.workSession.updateMany({
    where: { editorId: session.editorId, endedAt: null },
    data: { endedAt: new Date() },
  });
  return NextResponse.json({ stopped: result.count });
}
