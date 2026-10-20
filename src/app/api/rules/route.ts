import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveRules, getMinLoudnessLufs } from "@/lib/rules";

/** The checklist every editor ticks before submitting. Anyone signed in. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rules = await getActiveRules();
  const minLoudnessLufs = await getMinLoudnessLufs();
  return NextResponse.json({ rules, minLoudnessLufs });
}
