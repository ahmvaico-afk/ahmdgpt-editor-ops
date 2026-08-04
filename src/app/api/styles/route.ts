import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Explicit select: client billing rates live on this model too, and editors
  // (or anyone else hitting this endpoint) must never see those.
  const styles = await prisma.videoStyle.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      isCustomPricing: true,
      ratePerMinuteCents: true,
      perMinuteIncrementCents: true,
      active: true,
      sortOrder: true,
    },
  });

  return NextResponse.json({ styles });
}
