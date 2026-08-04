import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getFirstSubmitterToday,
  getMonthlyLeaderboard,
  getWeeklyLeaderboard,
  MONTHLY_BONUS_CENTS,
  WEEKLY_BONUS_CENTS,
} from "@/lib/leaderboard";

// Any authenticated session — editor or admin — can see this. It's meant to
// be shared: only aggregate counts, never any editor's pricing/earnings.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const weekly = await getWeeklyLeaderboard();
  const monthly = await getMonthlyLeaderboard();
  const firstToday = await getFirstSubmitterToday();

  return NextResponse.json({
    weekly,
    monthly,
    firstToday,
    weeklyBonusCents: WEEKLY_BONUS_CENTS,
    monthlyBonusCents: MONTHLY_BONUS_CENTS,
  });
}
