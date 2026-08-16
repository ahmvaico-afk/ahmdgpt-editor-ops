import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/auth";
import { updateStyleSchema } from "@/lib/validation";
import { dollarsToCents } from "@/lib/pricing";
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
  const parsed = updateStyleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  const data = parsed.data;

  const update: Prisma.VideoStyleUpdateInput = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.active !== undefined) update.active = data.active;
  if (data.sortOrder !== undefined) update.sortOrder = data.sortOrder;
  if (data.isCustomPricing !== undefined) update.isCustomPricing = data.isCustomPricing;
  if (data.ratePerMinuteDollars !== undefined) {
    update.ratePerMinuteCents =
      data.ratePerMinuteDollars === null ? null : dollarsToCents(data.ratePerMinuteDollars);
  }
  if (data.perMinuteIncrementDollars !== undefined) {
    update.perMinuteIncrementCents = dollarsToCents(data.perMinuteIncrementDollars);
  }

  const style = await prisma.videoStyle.update({ where: { id }, data: update });
  return NextResponse.json({ style });
}
