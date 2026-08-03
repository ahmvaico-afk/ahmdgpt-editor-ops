import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import { wipeBatchSchema } from "@/lib/validation";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { number } = await params;
  const batchNumber = Number(number);
  if (!Number.isInteger(batchNumber)) {
    return NextResponse.json({ error: "Invalid batch number." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = wipeBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  }

  const { count } = await prisma.videoSubmission.deleteMany({
    where: { batchNumber },
  });

  return NextResponse.json({ deleted: count });
}
