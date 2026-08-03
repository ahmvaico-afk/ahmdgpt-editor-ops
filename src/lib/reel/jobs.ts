import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, statfs } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProbeResult } from "./ffmpeg";
import type { ReelRatio } from "./spec";

export type ReelJobStatus = "uploaded" | "rendering" | "done" | "error";

export type ReelJob = {
  id: string;
  createdAt: number;
  status: ReelJobStatus;
  originalName: string;
  sourcePath: string;
  probe: ProbeResult;
  ratio: ReelRatio;
  /** Optional per-reel caption; 16:9 only, see `CAPTION_TEXT`. */
  caption?: string;
  /** 0..1, only meaningful while `status === "rendering"`. */
  progress: number;
  outputPath?: string;
  downloadName?: string;
  error?: string;
  process?: ChildProcess;
};

const JOB_TTL_MS = 2 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Renders live on one local machine, so an in-memory registry is enough — but
 * it hangs off `globalThis` so the dev server's module reloading doesn't orphan
 * in-flight jobs (same pattern as `lib/prisma.ts`).
 */
const globalForJobs = globalThis as unknown as {
  reelJobs?: Map<string, ReelJob>;
  reelSweeper?: NodeJS.Timeout;
};

const jobs = globalForJobs.reelJobs ?? new Map<string, ReelJob>();
globalForJobs.reelJobs = jobs;

/**
 * Where uploads and renders land. Defaults to the system temp dir, but video is
 * big — set `REEL_WORK_DIR` to a drive with room if the system drive is tight.
 */
export function reelWorkDir(): string {
  const configured = process.env.REEL_WORK_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(os.tmpdir(), "ahmdgpt-reel");
}

/** Free bytes on the volume holding the work dir, or null if unknowable. */
export async function freeSpaceBytes(): Promise<number | null> {
  try {
    const dir = reelWorkDir();
    await mkdir(dir, { recursive: true });
    const stats = await statfs(dir);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
}

/**
 * Fails fast when a render clearly won't fit, rather than letting FFmpeg die
 * halfway through with "No space left on device". Budgets for the upload plus
 * its rendered output plus the plates.
 */
export async function checkSpaceFor(uploadBytes: number): Promise<string | null> {
  const free = await freeSpaceBytes();
  if (free === null) return null;

  const needed = uploadBytes * 2 + 128 * 1024 * 1024;
  if (free >= needed) return null;

  const gb = (n: number) => `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  return (
    `Not enough disk space in ${reelWorkDir()} — ${gb(free)} free, this needs about ` +
    `${gb(needed)}. Free some space, or set REEL_WORK_DIR in .env to a drive with room.`
  );
}

export function jobDir(id: string): string {
  return path.join(reelWorkDir(), id);
}

export async function createJobDir(): Promise<{ id: string; dir: string }> {
  const id = randomUUID();
  const dir = jobDir(id);
  await mkdir(dir, { recursive: true });
  return { id, dir };
}

export function putJob(job: ReelJob): void {
  jobs.set(job.id, job);
}

export function getJob(id: string): ReelJob | undefined {
  return jobs.get(id);
}

export async function discardJob(id: string): Promise<void> {
  const job = jobs.get(id);
  if (!job) return;
  job.process?.kill("SIGKILL");
  jobs.delete(id);
  await rm(jobDir(id), { recursive: true, force: true }).catch(() => {});
}

/** Drops finished/abandoned jobs and their temp files. */
async function sweep(): Promise<void> {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff && job.status !== "rendering") {
      await discardJob(id);
    }
  }
}

if (!globalForJobs.reelSweeper) {
  const timer = setInterval(() => {
    void sweep();
  }, SWEEP_INTERVAL_MS);
  // Never hold the process open just to run cleanup.
  timer.unref?.();
  globalForJobs.reelSweeper = timer;
}

/** Shape sent to the browser — never leaks absolute paths or the child process. */
export function serializeJob(job: ReelJob) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    ratio: job.ratio,
    caption: job.caption ?? "",
    error: job.error ?? null,
    originalName: job.originalName,
    downloadName: job.downloadName ?? null,
    source: {
      width: job.probe.width,
      height: job.probe.height,
      durationSeconds: job.probe.durationSeconds,
      fps: job.probe.fps,
      videoCodec: job.probe.videoCodec,
      hasAudio: job.probe.hasAudio,
    },
  };
}

export type SerializedReelJob = ReturnType<typeof serializeJob>;
