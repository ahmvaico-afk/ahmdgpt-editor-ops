import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getJob, serializeJob } from "@/lib/reel/jobs";
import { renderReel } from "@/lib/reel/render";
import { CAPTION_TEXT, REEL_RATIOS, type ReelRatio } from "@/lib/reel/spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kicks off the FFmpeg composite and returns immediately. The browser polls
 * `/api/reel/jobs/:id` for progress, so a long render never depends on a single
 * request staying open.
 */
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { jobId?: unknown; ratio?: unknown; caption?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const jobId = typeof payload.jobId === "string" ? payload.jobId : null;
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { error: "That upload has expired. Upload the video again." },
      { status: 404 },
    );
  }

  if (job.status === "rendering") {
    return NextResponse.json({ job: serializeJob(job) }, { status: 202 });
  }

  if (typeof payload.ratio === "string") {
    if (!REEL_RATIOS.includes(payload.ratio as ReelRatio)) {
      return NextResponse.json({ error: "Unknown ratio." }, { status: 400 });
    }
    job.ratio = payload.ratio as ReelRatio;
  }

  if (payload.caption !== undefined) {
    if (typeof payload.caption !== "string") {
      return NextResponse.json({ error: "Caption must be text." }, { status: 400 });
    }
    // Trimmed and capped here so an oversized body can never reach the SVG;
    // `captionLines` still escapes and wraps whatever survives.
    job.caption = payload.caption.trim().slice(0, CAPTION_TEXT.maxChars);
  }

  job.status = "rendering";
  job.progress = 0;
  job.error = undefined;
  job.outputPath = undefined;

  void renderReel(job).catch((err: unknown) => {
    job.status = "error";
    job.progress = 0;
    job.error = err instanceof Error ? err.message : "The render failed.";
  });

  return NextResponse.json({ job: serializeJob(job) }, { status: 202 });
}
