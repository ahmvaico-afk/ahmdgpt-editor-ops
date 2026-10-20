import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireReviewerSession } from "@/lib/auth";
import { createClientRuleSchema, updateRuleSettingsSchema } from "@/lib/validation";
import { getMinLoudnessLufs, setMinLoudnessLufs } from "@/lib/rules";

/*
 * Client rules are managed by whoever reviews work — the owner or a QA editor —
 * since they're the ones hearing the client's revisions.
 */

export async function GET() {
  if (!(await requireReviewerSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rules = await prisma.clientRule.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const minLoudnessLufs = await getMinLoudnessLufs();
  return NextResponse.json({ rules, minLoudnessLufs });
}

export async function POST(request: NextRequest) {
  if (!(await requireReviewerSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createClientRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Give the rule a group and some text." }, { status: 400 });
  }
  const data = parsed.data;

  // New rules join the end of their group, so they sit with their neighbours.
  const lastInGroup = await prisma.clientRule.aggregate({
    where: { category: data.category },
    _max: { sortOrder: true },
  });
  const lastOverall = await prisma.clientRule.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (lastInGroup._max.sortOrder ?? lastOverall._max.sortOrder ?? 0) + 1;

  const rule = await prisma.clientRule.create({
    data: {
      category: data.category,
      text: data.text,
      detail: data.detail || null,
      source: data.source || null,
      appliesTo: data.appliesTo,
      sortOrder,
    },
  });
  return NextResponse.json({ rule }, { status: 201 });
}

/** The loudness bar every export has to clear. */
export async function PUT(request: NextRequest) {
  if (!(await requireReviewerSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateRuleSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a loudness between -40 and 0." }, { status: 400 });
  }
  const minLoudnessLufs = await setMinLoudnessLufs(parsed.data.minLoudnessLufs);
  return NextResponse.json({ minLoudnessLufs });
}
