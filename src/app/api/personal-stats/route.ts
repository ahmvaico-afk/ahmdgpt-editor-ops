import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPersonalStats } from "@/lib/leaderboard";

// Editor-only — these are personal records (best day, streak), not shared data.
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "editor") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const stats = await getPersonalStats(session.editorId);
  return NextResponse.json(stats);
}
