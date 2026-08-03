import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { probeVideo } from "@/lib/reel/ffmpeg";
import {
  checkSpaceFor,
  createJobDir,
  jobDir,
  putJob,
  serializeJob,
  type ReelJob,
} from "@/lib/reel/jobs";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  formatBytes,
  looksLikeVideo,
} from "@/lib/reel/limits";
import { ratioForDimensions } from "@/lib/reel/spec";

export const runtime = "nodejs";
/** The body is streamed straight to disk, so it must never be cached. */
export const dynamic = "force-dynamic";

class UploadTooLarge extends Error {}

/**
 * Raw-body upload: the file arrives as the request body with its name in a
 * header, rather than as multipart form-data. That keeps the whole thing
 * streamable to disk — `request.formData()` would buffer a multi-hundred-MB
 * video into memory first — and it makes real upload progress possible on the
 * client via XHR.
 */
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rawName = request.headers.get("x-reel-filename");
  const originalName = rawName ? decodeURIComponent(rawName) : "testimonial.mp4";
  const mimeType = request.headers.get("content-type") ?? "";

  if (!looksLikeVideo(originalName, mimeType)) {
    return NextResponse.json(
      {
        error: `"${originalName}" doesn't look like a video file. Upload an MP4, MOV, M4V or WebM.`,
      },
      { status: 415 },
    );
  }

  // Reject oversized uploads before reading a single byte where we can.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `That file is ${formatBytes(declared)}. The limit is ${MAX_UPLOAD_MB} MB.`,
      },
      { status: 413 },
    );
  }

  if (!request.body) {
    return NextResponse.json({ error: "No file was sent." }, { status: 400 });
  }

  // Better to refuse up front than to die mid-render with ENOSPC.
  if (Number.isFinite(declared) && declared > 0) {
    const spaceError = await checkSpaceFor(declared);
    if (spaceError) {
      return NextResponse.json({ error: spaceError }, { status: 507 });
    }
  }

  const extension = path.extname(originalName).toLowerCase() || ".mp4";
  const { id, dir } = await createJobDir();
  const sourcePath = path.join(dir, `source${extension}`);

  let received = 0;

  try {
    const body = Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]);

    await pipeline(
      body,
      async function* (source) {
        for await (const chunk of source) {
          received += (chunk as Buffer).byteLength;
          if (received > MAX_UPLOAD_BYTES) {
            throw new UploadTooLarge();
          }
          yield chunk;
        }
      },
      createWriteStream(sourcePath),
    );
  } catch (err) {
    await rm(jobDir(id), { recursive: true, force: true }).catch(() => {});
    if (err instanceof UploadTooLarge) {
      return NextResponse.json(
        { error: `That file is over the ${MAX_UPLOAD_MB} MB limit.` },
        { status: 413 },
      );
    }
    if ((err as NodeJS.ErrnoException)?.code === "ENOSPC") {
      return NextResponse.json(
        {
          error:
            "The disk filled up while saving the upload. Free some space, or set " +
            "REEL_WORK_DIR in .env to a drive with more room.",
        },
        { status: 507 },
      );
    }
    return NextResponse.json(
      { error: "The upload was interrupted before it finished. Try again." },
      { status: 400 },
    );
  }

  if (received === 0) {
    await rm(jobDir(id), { recursive: true, force: true }).catch(() => {});
    return NextResponse.json({ error: "The uploaded file was empty." }, { status: 400 });
  }

  // ffprobe is the real validity check — extension and MIME type both lie.
  let probe;
  try {
    probe = await probeVideo(sourcePath);
  } catch (err) {
    await rm(jobDir(id), { recursive: true, force: true }).catch(() => {});
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "That file could not be read as video." },
      { status: 415 },
    );
  }

  const job: ReelJob = {
    id,
    createdAt: Date.now(),
    status: "uploaded",
    originalName,
    sourcePath,
    probe,
    ratio: ratioForDimensions(probe.width, probe.height),
    progress: 0,
  };
  putJob(job);

  return NextResponse.json({ job: serializeJob(job), bytes: received }, { status: 201 });
}
