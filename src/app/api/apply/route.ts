import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { ATTENTION_WORD, applicantSchema } from "@/lib/validation";

/**
 * The one public write endpoint in the app — the hiring form gets shared on a
 * story, so anyone can reach it. Rate limited by IP, every field bounded, and
 * it returns nothing an attacker could use to enumerate anything.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const rate = checkRateLimit(`apply:${ip}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many applications from here. Try again later." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = applicantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some answers are missing or too long." },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // Scored, not enforced: a wrong answer still saves, flagged, so the owner can
  // see who skimmed rather than silently losing an otherwise decent applicant.
  const attentionPassed = d.attentionAnswer.trim().toLowerCase() === ATTENTION_WORD;

  await prisma.applicant.create({
    data: {
      name: d.name,
      whatsapp: d.whatsapp,
      city: d.city || null,
      hasAiAdsExperience: d.hasAiAdsExperience,
      portfolio: d.portfolio || null,
      software: d.software,
      aiTools: d.aiTools || null,
      ownsComputer: d.ownsComputer,
      computerSpecs: d.computerSpecs || null,
      ownsPhone: d.ownsPhone,
      hoursPerDay: d.hoursPerDay,
      handlesFeedback: d.handlesFeedback,
      turnaround: d.turnaround || null,
      expectedPayPkr: d.expectedPayPkr || null,
      whyYou: d.whyYou || null,
      attentionAnswer: d.attentionAnswer,
      attentionPassed,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
