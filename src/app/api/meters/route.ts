import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCurrentBatch } from "@/lib/batch";
import { REVISION_COST, MIN_VIDEOS_FOR_RANKING, getEditorMeters } from "@/lib/meters";

/**
 * Open to any signed-in session, editor or owner: every editor sees every
 * editor's meter. Deliberate — a score nobody can compare against reads as
 * arbitrary, and the whole point is that people can see where they stand.
 *
 * Carries no rates or payouts, so this stays safe for editors to read.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const batchParam = request.nextUrl.searchParams.get("batch");
  const currentBatch = await getCurrentBatch();
  const batchNumber = batchParam === "all" ? null : Number(batchParam || currentBatch);
  if (batchNumber != null && !Number.isInteger(batchNumber)) {
    return NextResponse.json({ error: "Invalid batch number." }, { status: 400 });
  }

  const meters = await getEditorMeters(batchNumber);

  return NextResponse.json({
    meters,
    batchNumber,
    currentBatch,
    batches: Array.from({ length: currentBatch }, (_, i) => currentBatch - i),
    revisionCost: REVISION_COST,
    minVideosForRanking: MIN_VIDEOS_FOR_RANKING,
    // Editors get their own id back so the UI can mark their row.
    viewerEditorId: session.role === "editor" ? session.editorId : null,
  });
}
