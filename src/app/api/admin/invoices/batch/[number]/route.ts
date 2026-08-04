import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { hasInvoiceUnlock } from "@/lib/invoice-auth";
import { calculatePriceCents } from "@/lib/pricing";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await hasInvoiceUnlock())) {
    return NextResponse.json({ error: "Invoice access locked." }, { status: 403 });
  }

  const { number } = await params;
  const batchNumber = Number(number);
  if (!Number.isInteger(batchNumber)) {
    return NextResponse.json({ error: "Invalid batch number." }, { status: 400 });
  }

  const submissions = await prisma.videoSubmission.findMany({
    where: { batchNumber },
    include: { editor: { select: { name: true, editorCode: true } }, style: true },
    orderBy: { submittedAt: "asc" },
  });

  const items = submissions.map((s) => {
    const rate = s.style.clientRatePerMinuteCents;
    const clientPriceCents =
      rate == null ? null : calculatePriceCents(s.durationMinutes, rate, s.style.clientPerMinuteIncrementCents);
    return {
      id: s.id,
      title: s.title,
      styleName: s.styleName,
      clientOrProject: s.clientOrProject,
      durationMinutes: s.durationMinutes,
      editor: s.editor,
      submittedAt: s.submittedAt,
      clientPriceCents,
      rateMissing: rate == null,
    };
  });

  const totalCents = items.reduce((sum, i) => sum + (i.clientPriceCents ?? 0), 0);
  const hasMissingRates = items.some((i) => i.rateMissing);

  return NextResponse.json({ batchNumber, items, totalCents, hasMissingRates });
}
