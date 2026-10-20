import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReviewerSession } from "@/lib/auth";
import { updateClientRuleSchema } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireReviewerSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateClientRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  const data = parsed.data;

  const update: Prisma.ClientRuleUpdateInput = {};
  if (data.category !== undefined) update.category = data.category;
  if (data.text !== undefined) update.text = data.text;
  if (data.detail !== undefined) update.detail = data.detail || null;
  if (data.source !== undefined) update.source = data.source || null;
  if (data.appliesTo !== undefined) update.appliesTo = data.appliesTo;
  if (data.active !== undefined) update.active = data.active;
  if (data.sortOrder !== undefined) update.sortOrder = data.sortOrder;

  const result = await prisma.clientRule.updateMany({ where: { id }, data: update });
  if (result.count === 0) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireReviewerSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.clientRule.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Rule not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
