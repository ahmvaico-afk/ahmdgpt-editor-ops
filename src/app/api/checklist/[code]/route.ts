import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findByCode, summarize } from "@/lib/briefs";
import { getMinLoudnessLufs } from "@/lib/rules";
import { toggleChecklistItemSchema } from "@/lib/validation";

/*
 * The editor's side of a brief checklist. No login: the unguessable code in
 * the link QA sends is the access, so editors can open it straight from
 * WhatsApp. Nothing here touches money or anyone else's work.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const row = await findByCode(code);
  if (!row) {
    return NextResponse.json(
      { error: "This checklist doesn't exist, or it was deleted." },
      { status: 404 }
    );
  }
  const { items, checked } = summarize(row);
  return NextResponse.json({
    title: row.title,
    adType: row.adType,
    brief: row.brief,
    editorName: row.editor?.name ?? null,
    items,
    checked,
    minLoudnessLufs: await getMinLoudnessLufs(),
  });
}

/** Tick or untick one item. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = await request.json().catch(() => null);
  const parsed = toggleChecklistItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const row = await prisma.briefChecklist.findUnique({ where: { code } });
  if (!row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const { items, checked } = summarize(row);
  if (!items.some((i) => i.id === parsed.data.itemId)) {
    return NextResponse.json({ error: "Not on this checklist." }, { status: 400 });
  }

  const next = new Set(checked);
  if (parsed.data.checked) next.add(parsed.data.itemId);
  else next.delete(parsed.data.itemId);
  await prisma.briefChecklist.update({ where: { code }, data: { checked: [...next] } });
  return NextResponse.json({ checked: [...next] });
}
