import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { editorLoginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = editorLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  }

  const editorCode = parsed.data.editorCode.toLowerCase();
  const rate = checkRateLimit(`editor-login:${editorCode}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 }
    );
  }

  const editor = await prisma.editor.findUnique({ where: { editorCode } });
  if (!editor || !editor.active) {
    return NextResponse.json({ error: "Invalid code or PIN." }, { status: 401 });
  }

  const valid = await bcrypt.compare(parsed.data.pin, editor.pinHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid code or PIN." }, { status: 401 });
  }

  const token = await createSessionToken({
    role: "editor",
    editorId: editor.id,
    editorCode: editor.editorCode,
    name: editor.name,
  });

  const response = NextResponse.json({ ok: true, editorCode: editor.editorCode });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
