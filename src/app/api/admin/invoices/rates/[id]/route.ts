import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { hasInvoiceUnlock } from "@/lib/invoice-auth";
import { updateClientRateSchema } from "@/lib/validation";
import { dollarsToCents } from "@/lib/pricing";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await hasInvoiceUnlock())) {
    return NextResponse.json({ error: "Invoice access locked." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateClientRateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rate." }, { status: 400 });
  }
  const data = parsed.data;

  const style = await prisma.videoStyle.update({
    where: { id },
    data: {
      clientRatePerMinuteCents:
        data.clientRateDollars === null ? null : dollarsToCents(data.clientRateDollars),
      ...(data.clientIncrementDollars !== undefined
        ? { clientPerMinuteIncrementCents: dollarsToCents(data.clientIncrementDollars) }
        : {}),
    },
  });

  return NextResponse.json({ style });
}
