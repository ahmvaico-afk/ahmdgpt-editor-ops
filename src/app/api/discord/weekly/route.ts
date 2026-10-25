import { NextResponse } from "next/server";
import { postDiscord } from "@/lib/discord";
import { lastWeekWrapUp, weekStart } from "@/lib/weekly";

export const dynamic = "force-dynamic";

// Posts last week's wrap-up to #portal-activity. Called every Monday morning by
// the GitHub Actions schedule in .github/workflows/weekly-discord.yml.
//
// No auth on purpose: it only posts on Mondays (Pakistan time) and only once per
// week per running instance, so hitting it again does nothing. A restart on a
// Monday could let one duplicate through, which is harmless.
let postedWeekKey: string | null = null;

export async function GET() {
  const now = new Date();
  const isMondayPkt = now.getTime() - weekStart(now).getTime() < 24 * 60 * 60 * 1000;
  if (!isMondayPkt) {
    return NextResponse.json({ posted: false, reason: "Only runs on Mondays." });
  }

  const wrapUp = await lastWeekWrapUp();
  if (!wrapUp) {
    return NextResponse.json({ posted: false, reason: "Nothing logged last week." });
  }
  if (postedWeekKey === wrapUp.weekKey) {
    return NextResponse.json({ posted: false, reason: "Already posted this week." });
  }

  const ok = await postDiscord(wrapUp.message);
  if (ok) postedWeekKey = wrapUp.weekKey;
  return NextResponse.json({ posted: ok });
}
