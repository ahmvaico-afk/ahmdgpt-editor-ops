import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { hasInvoiceUnlock } from "@/lib/invoice-auth";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!(await hasInvoiceUnlock())) {
    return NextResponse.json({ error: "Invoice access locked." }, { status: 403 });
  }

  const styles = await prisma.videoStyle.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ styles });
}
