import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { checkInvoicePassword, createInvoiceUnlockToken, INVOICE_UNLOCK_COOKIE, invoiceUnlockCookieOptions } from "@/lib/invoice-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rate = checkRateLimit(`invoice-unlock:${session.adminId}`);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  const ok = await checkInvoicePassword(password);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await createInvoiceUnlockToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(INVOICE_UNLOCK_COOKIE, token, invoiceUnlockCookieOptions);
  return response;
}
