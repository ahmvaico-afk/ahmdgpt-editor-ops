import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/auth";
import { createStyleSchema } from "@/lib/validation";
import { dollarsToCents } from "@/lib/pricing";

export async function GET() {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const styles = await prisma.videoStyle.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ styles });
}

export async function POST(request: NextRequest) {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createStyleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid style." }, { status: 400 });
  }
  const data = parsed.data;

  if (!data.isCustomPricing && data.ratePerMinuteDollars === undefined) {
    return NextResponse.json(
      { error: "A per-minute rate is required unless custom pricing is enabled." },
      { status: 400 }
    );
  }

  const maxSort = await prisma.videoStyle.aggregate({ _max: { sortOrder: true } });

  const style = await prisma.videoStyle.create({
    data: {
      name: data.name,
      isCustomPricing: data.isCustomPricing,
      ratePerMinuteCents: data.isCustomPricing
        ? null
        : dollarsToCents(data.ratePerMinuteDollars as number),
      perMinuteIncrementCents: data.perMinuteIncrementDollars
        ? dollarsToCents(data.perMinuteIncrementDollars)
        : 0,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json({ style }, { status: 201 });
}
