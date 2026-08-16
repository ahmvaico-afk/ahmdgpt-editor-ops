import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { adminLoginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const loginCode = parsed.data.loginCode.toLowerCase();
  const rate = checkRateLimit(`admin-login:${loginCode}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const admin = await prisma.adminUser.findUnique({ where: { loginCode } });
  if (!admin) {
    return NextResponse.json({ error: "Invalid code or PIN." }, { status: 401 });
  }

  const valid = await bcrypt.compare(parsed.data.pin, admin.pinHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid code or PIN." }, { status: 401 });
  }

  const token = await createSessionToken({
    role: "admin",
    adminId: admin.id,
    loginCode: admin.loginCode,
    name: admin.name,
    adminRole: admin.role === "qa" ? "qa" : "owner",
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
