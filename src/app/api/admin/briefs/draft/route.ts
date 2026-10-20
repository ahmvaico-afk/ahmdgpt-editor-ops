import { NextRequest, NextResponse } from "next/server";
import { requireReviewerSession } from "@/lib/auth";
import { draftBriefSchema } from "@/lib/validation";
import { draftChecklist } from "@/lib/briefs";

/** Proposes a checklist for a brief. Nothing is saved until QA sends it. */
export async function POST(request: NextRequest) {
  if (!(await requireReviewerSession())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = draftBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick the ad type and paste the brief." }, { status: 400 });
  }

  const draft = await draftChecklist(parsed.data.adType, parsed.data.brief);
  return NextResponse.json(draft);
}
