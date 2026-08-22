import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { screenApplicant } from "@/lib/screening";
import { applicantSchema } from "@/lib/validation";

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

  // Scored server-side, never trusted from the client. Nothing is rejected
  // outright — failures are sorted into their own pile so the main list stays
  // clean, but an otherwise decent applicant is never silently lost.
  const screen = screenApplicant({
    attentionAnswer: d.attentionAnswer,
    secondsTaken: d.secondsTaken ?? 0,
    ownsComputer: d.ownsComputer,
  });

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
      whyYou: d.whyYou || null,
      attentionAnswer: d.attentionAnswer,
      secondsTaken: d.secondsTaken ?? 0,
      attentionPassed: screen.attentionPassed,
      autoFiltered: screen.autoFiltered,
      filterReason: screen.filterReason,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
