import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCurrentBatch } from "@/lib/batch";

// Any authenticated session (editor or admin) can read the current batch —
// unlike /api/admin/batches, this carries no per-batch financials.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const currentBatch = await getCurrentBatch();
  return NextResponse.json({ currentBatch });
}
