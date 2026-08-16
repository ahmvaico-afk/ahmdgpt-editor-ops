import { NextRequest, NextResponse } from "next/server";
import { requireEditorSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startWorkItemSchema } from "@/lib/validation";

function totalMs(sessions: { startedAt: Date; endedAt: Date | null }[], now: number): number {
  return sessions.reduce((sum, s) => {
    const end = s.endedAt ? s.endedAt.getTime() : now;
    return sum + Math.max(0, end - s.startedAt.getTime());
  }, 0);
}

/**
 * The editor's live work: whatever is running, plus everything submitted and
 * awaiting QA (which can still be resumed if changes come back).
 */
export async function GET() {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = Date.now();
  const items = await prisma.workItem.findMany({
    where: { editorId: session.editorId, status: { in: ["working", "submitted"] } },
    orderBy: { createdAt: "desc" },
    include: { sessions: { select: { startedAt: true, endedAt: true } } },
  });

  return NextResponse.json({
    items: items.map((i) => {
      const open = i.sessions.find((s) => !s.endedAt) ?? null;
      return {
        id: i.id,
        label: i.label,
        status: i.status,
        submissionId: i.submissionId,
        minutes: Math.round(totalMs(i.sessions, now) / 60000),
        // Lets the browser tick a live counter without polling.
        runningSince: open ? open.startedAt : null,
      };
    }),
  });
}

/** Names a video and starts its clock. The submission comes later. */
export async function POST(request: NextRequest) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = startWorkItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Name the video you're starting." }, { status: 400 });
  }

  // One clock at a time: anything still running is put back to submitted, so
  // switching videos can't leave two counters going.
  await closeRunning(session.editorId);

  const item = await prisma.workItem.create({
    data: {
      editorId: session.editorId,
      label: parsed.data.label.trim(),
      status: "working",
      sessions: { create: {} },
    },
  });
  return NextResponse.json({ item: { id: item.id, label: item.label } }, { status: 201 });
}

/** Ends every open span for this editor and parks those items as submitted. */
async function closeRunning(editorId: string): Promise<void> {
  const running = await prisma.workItem.findMany({
    where: { editorId, status: "working" },
    select: { id: true },
  });
  if (running.length === 0) return;
  const ids = running.map((r) => r.id);
  await prisma.workSession.updateMany({
    where: { workItemId: { in: ids }, endedAt: null },
    data: { endedAt: new Date() },
  });
  await prisma.workItem.updateMany({
    where: { id: { in: ids } },
    data: { status: "submitted" },
  });
}
