import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createSubmissionSchema } from "@/lib/validation";
import { calculatePriceCents, dollarsToCents } from "@/lib/pricing";
import { getCurrentBatch } from "@/lib/batch";
import type { Prisma } from "@/generated/prisma/client";

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = request.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const where: Prisma.VideoSubmissionWhereInput = {};

  if (session.role === "editor") {
    where.editorId = session.editorId;
  } else {
    const editorId = url.searchParams.get("editorId");
    const styleId = url.searchParams.get("styleId");
    const status = url.searchParams.get("status");
    const batch = url.searchParams.get("batch");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (editorId) where.editorId = editorId;
    if (styleId) where.styleId = styleId;
    if (status) where.status = status as Prisma.EnumSubmissionStatusFilter["equals"];
    if (batch) where.batchNumber = Number(batch);
    if (from || to) {
      where.submittedAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
      };
    }
  }

  // Sequential, not Promise.all: concurrent queries through the pg driver
  // adapter's shared pool can corrupt prepared statements under load.
  const items = await prisma.videoSubmission.findMany({
    where,
    include: { editor: { select: { name: true, editorCode: true } } },
    orderBy: { submittedAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const total = await prisma.videoSubmission.count({ where });

  return NextResponse.json({ items, total, page, pageSize: PAGE_SIZE });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "editor") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid submission." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const style = await prisma.videoStyle.findUnique({ where: { id: data.styleId } });
  if (!style || !style.active) {
    return NextResponse.json({ error: "Selected style is not available." }, { status: 400 });
  }

  const durationMinutes = data.durationMinutes;
  let pricePerMinuteCents: number;
  let incrementPerMinuteCents = 0;

  if (style.isCustomPricing) {
    if (data.customRatePerMinuteDollars === undefined) {
      return NextResponse.json(
        { error: "A rate per minute is required for this style." },
        { status: 400 }
      );
    }
    pricePerMinuteCents = dollarsToCents(data.customRatePerMinuteDollars);
  } else {
    if (style.ratePerMinuteCents == null) {
      return NextResponse.json({ error: "This style has no rate set." }, { status: 400 });
    }
    pricePerMinuteCents = style.ratePerMinuteCents;
    incrementPerMinuteCents = style.perMinuteIncrementCents;
  }

  const calculatedPriceCents = calculatePriceCents(
    durationMinutes,
    pricePerMinuteCents,
    incrementPerMinuteCents
  );

  const batchNumber = await getCurrentBatch();

  const submission = await prisma.videoSubmission.create({
    data: {
      editorId: session.editorId,
      styleId: style.id,
      styleName: style.name,
      title: data.title,
      clientOrProject: data.clientOrProject || null,
      videoLink: data.videoLink,
      durationMinutes,
      pricePerMinuteCents,
      calculatedPriceCents,
      batchNumber,
      notes: data.notes || null,
    },
  });

  return NextResponse.json({ submission }, { status: 201 });
}
