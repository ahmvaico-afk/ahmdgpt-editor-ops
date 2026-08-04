import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getWeeklyLeaderboard } from "@/lib/leaderboard";

// Any authenticated session — editor or admin — can see this. It's meant to
// be shared: only aggregate counts, never any editor's pricing/earnings.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await getWeeklyLeaderboard();
  return NextResponse.json(result);
}
