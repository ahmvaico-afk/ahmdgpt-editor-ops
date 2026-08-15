import { NextRequest, NextResponse } from "next/server";
import { requireEditorSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenSession } from "@/lib/meters";
import { startWorkSessionSchema } from "@/lib/validation";

/**
 * The editor's running timer plus any finished-but-unlinked spans.
 *
 * Unlinked spans are the ones waiting to be attached to a video: the editor
 * starts the clock on "Rosabella #2" before that submission exists, and only
 * adds the video — with its duration — once the work is done.
 */
export async function GET() {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const open = await getOpenSession(session.editorId);
  const unlinked = await prisma.workSession.findMany({
    where: { editorId: session.editorId, submissionId: null, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    session: open
      ? { id: open.id, label: open.label, startedAt: open.startedAt }
      : null,
    unlinked: unlinked.map((w) => ({
      id: w.id,
      label: w.label,
      startedAt: w.startedAt,
      endedAt: w.endedAt,
      minutes: w.endedAt
        ? Math.max(0, Math.round((w.endedAt.getTime() - w.startedAt.getTime()) / 60000))
        : 0,
    })),
  });
}

/** Starts the clock on a video the editor names now and submits later. */
export async function POST(request: NextRequest) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = startWorkSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Name the video you're starting." }, { status: 400 });
  }

  // One clock at a time. Starting something new closes whatever was running,
  // so switching tasks can't strand a session open forever.
  await prisma.workSession.updateMany({
    where: { editorId: session.editorId, endedAt: null },
    data: { endedAt: new Date() },
  });

  const created = await prisma.workSession.create({
    data: { editorId: session.editorId, label: parsed.data.label.trim() },
  });
  return NextResponse.json(
    { session: { id: created.id, label: created.label, startedAt: created.startedAt } },
    { status: 201 },
  );
}

/** Stops the clock. The span sits unlinked until the video is added. */
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
