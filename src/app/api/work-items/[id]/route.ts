import { NextRequest, NextResponse } from "next/server";
import { requireEditorSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workItemActionSchema } from "@/lib/validation";

/**
 * Moves a piece of work through its lifecycle.
 *
 *   submit  - stop the clock, hand to QA; can still be resumed
 *   resume  - changes came back, start a fresh span
 *   finish  - done for good. Requires the editor to type "finish", because it
 *             is the one action here that can't be undone from the portal.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = workItemActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  // Scoped by editorId as well as id, so one editor can never move another's
  // work through the lifecycle.
  const item = await prisma.workItem.findFirst({
    where: { id, editorId: session.editorId },
  });
  if (!item) {
    return NextResponse.json({ error: "That work isn't yours." }, { status: 404 });
  }
  if (item.status === "finished") {
    return NextResponse.json({ error: "That one is already finished." }, { status: 409 });
  }

  const { action } = parsed.data;

  if (action === "submit") {
    await prisma.workSession.updateMany({
      where: { workItemId: item.id, endedAt: null },
      data: { endedAt: new Date() },
    });
    await prisma.workItem.update({ where: { id: item.id }, data: { status: "submitted" } });
    return NextResponse.json({ ok: true, status: "submitted" });
  }

  if (action === "resume") {
    // Close anything else that's running first — still one clock at a time.
    const others = await prisma.workItem.findMany({
      where: { editorId: session.editorId, status: "working", id: { not: item.id } },
      select: { id: true },
    });
    if (others.length > 0) {
      const ids = others.map((o) => o.id);
      await prisma.workSession.updateMany({
        where: { workItemId: { in: ids }, endedAt: null },
        data: { endedAt: new Date() },
      });
      await prisma.workItem.updateMany({
        where: { id: { in: ids } },
        data: { status: "submitted" },
      });
    }
    await prisma.workSession.create({ data: { workItemId: item.id } });
    await prisma.workItem.update({ where: { id: item.id }, data: { status: "working" } });
    return NextResponse.json({ ok: true, status: "working" });
  }

  // finish — the typed word is the second layer, checked server-side so a
  // stray click can't get through even if the UI is bypassed.
  if (parsed.data.confirm?.trim().toLowerCase() !== "finish") {
    return NextResponse.json(
      { error: 'Type "finish" to confirm.' },
      { status: 400 },
    );
  }
  await prisma.workSession.updateMany({
    where: { workItemId: item.id, endedAt: null },
    data: { endedAt: new Date() },
  });
  await prisma.workItem.update({
    where: { id: item.id },
    data: { status: "finished", finishedAt: new Date() },
  });
  return NextResponse.json({ ok: true, status: "finished" });
}
