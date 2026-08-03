import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { getCurrentBatch, setCurrentBatch } from "@/lib/batch";
import { updateBatchSettingsSchema } from "@/lib/validation";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Sequential, not Promise.all: concurrent queries through the pg driver
  // adapter's shared pool can corrupt prepared statements under load.
  const currentBatch = await getCurrentBatch();
  const grouped = await prisma.videoSubmission.groupBy({
    by: ["batchNumber"],
    _count: true,
    _sum: { calculatedPriceCents: true },
    orderBy: { batchNumber: "desc" },
  });

  const batches = grouped.map((g) => ({
    number: g.batchNumber,
    count: g._count,
    totalCents: g._sum.calculatedPriceCents ?? 0,
  }));

  return NextResponse.json({ currentBatch, batches });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateBatchSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid batch number." }, { status: 400 });
  }

  const currentBatch = await setCurrentBatch(parsed.data.currentBatch);
  return NextResponse.json({ currentBatch });
}
