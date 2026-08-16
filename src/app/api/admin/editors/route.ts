import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireOwnerSession } from "@/lib/auth";
import { createEditorSchema } from "@/lib/validation";
import { generateEditorCode } from "@/lib/editor-code";

export async function GET() {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Explicit select, not include: `include` returns every scalar on Editor,
  // which put the bcrypt pinHash on the wire.
  const editors = await prisma.editor.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      editorCode: true,
      active: true,
      isQa: true,
      createdAt: true,
      _count: { select: { submissions: true } },
    },
  });

  return NextResponse.json({ editors });
}

export async function POST(request: NextRequest) {
  const session = await requireOwnerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createEditorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid editor." }, { status: 400 });
  }
  const data = parsed.data;

  const editorCode = await generateEditorCode(data.name);
  const pinHash = await bcrypt.hash(data.pin, 12);

  const editor = await prisma.editor.create({
    data: { name: data.name, editorCode, pinHash },
  });

  return NextResponse.json({ editor }, { status: 201 });
}
