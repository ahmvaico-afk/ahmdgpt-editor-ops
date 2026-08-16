import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/auth";
import { updateEditorSchema } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateEditorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  const data = parsed.data;

  const update: Prisma.EditorUpdateInput = {};
  if (data.active !== undefined) update.active = data.active;
  if (data.isQa !== undefined) update.isQa = data.isQa;
  if (data.name !== undefined) update.name = data.name;
  if (data.pin !== undefined) update.pinHash = await bcrypt.hash(data.pin, 12);

  const editor = await prisma.editor.update({ where: { id }, data: update });
  return NextResponse.json({ editor });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  await prisma.editor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
