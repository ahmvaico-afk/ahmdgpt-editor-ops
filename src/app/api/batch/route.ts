import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCurrentBatch } from "@/lib/batch";
import { prisma } from "@/lib/prisma";

// Any authenticated session (editor or admin) can read the current batch —
// unlike /api/admin/batches, this carries no per-batch financials.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const currentBatch = await getCurrentBatch();

  if (session.role !== "editor") {
    return NextResponse.json({ currentBatch });
  }

  const distinct = await prisma.videoSubmission.findMany({
    where: { editorId: session.editorId },
    distinct: ["batchNumber"],
    select: { batchNumber: true },
  });

  const editorBatches = Array.from(
    new Set([...distinct.map((d) => d.batchNumber), currentBatch])
  ).sort((a, b) => b - a);

  return NextResponse.json({ currentBatch, editorBatches });
}
