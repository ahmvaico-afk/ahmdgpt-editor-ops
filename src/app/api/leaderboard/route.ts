import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCurrentBatch } from "@/lib/batch";
import {
  getBatchLeaderboard,
  getFirstSubmitterToday,
  getMonthlyLeaderboard,
  BATCH_BONUS_CENTS,
  MONTHLY_BONUS_CENTS,
} from "@/lib/leaderboard";

// Any authenticated session — editor or admin — can see this. It's meant to
// be shared: only aggregate counts, never any editor's pricing/earnings.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const currentBatch = await getCurrentBatch();
  const requestedBatch = Number(request.nextUrl.searchParams.get("batch"));
  const batchNumber =
    Number.isInteger(requestedBatch) && requestedBatch > 0 ? requestedBatch : currentBatch;

  const batch = await getBatchLeaderboard(batchNumber);
  const monthly = await getMonthlyLeaderboard();
  const firstToday = await getFirstSubmitterToday();

  const batches = Array.from({ length: currentBatch }, (_, i) => currentBatch - i);

  return NextResponse.json({
    batch,
    batchNumber,
    currentBatch,
    batches,
    monthly,
    firstToday,
    batchBonusCents: BATCH_BONUS_CENTS,
    monthlyBonusCents: MONTHLY_BONUS_CENTS,
  });
}
