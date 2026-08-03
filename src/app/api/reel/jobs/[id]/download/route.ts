import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { getJob } from "@/lib/reel/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams the finished MP4 back as an attachment. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const job = getJob(id);

  if (!job || job.status !== "done" || !job.outputPath) {
    return NextResponse.json({ error: "No finished render for this job." }, { status: 404 });
  }

  let size: number;
  try {
    ({ size } = await stat(job.outputPath));
  } catch {
    return NextResponse.json(
      { error: "The rendered file is no longer on disk. Render it again." },
      { status: 410 },
    );
  }

  const filename = job.downloadName ?? "ahmdgpt-reel.mp4";
  const stream = Readable.toWeb(
    createReadStream(job.outputPath),
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
