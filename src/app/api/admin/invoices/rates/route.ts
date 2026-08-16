import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/auth";
import { hasInvoiceUnlock } from "@/lib/invoice-auth";

export async function GET() {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await hasInvoiceUnlock())) {
    return NextResponse.json({ error: "Invoice access locked." }, { status: 403 });
  }

  const styles = await prisma.videoStyle.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ styles });
}
