import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession, requireEditorSession } from "@/lib/auth";
import { updateSubmissionSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const submission = await prisma.videoSubmission.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ submission });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireEditorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const submission = await prisma.videoSubmission.findUnique({ where: { id } });

  if (!submission || submission.editorId !== session.editorId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (submission.status !== "submitted") {
    return NextResponse.json(
      { error: "Only videos still in 'submitted' status can be removed." },
      { status: 400 }
    );
  }

  await prisma.videoSubmission.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
