/** Upload and render constraints, shared by the API routes and the UI copy. */
import { GRAIN_VIDEO } from "./spec";

/** Renders run on your own machine, so this is about sanity, not hosting caps. */
export const MAX_UPLOAD_MB = Math.max(
  1,
  Number(process.env.REEL_MAX_UPLOAD_MB) || 1024,
);

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * iPhone records `.mov` (often HEVC) and some Android/screen tools emit `.mkv`
 * or `.avi`. The extension is only a first-pass filter — ffprobe is the real
 * gate, so an odd container with a valid video track still gets through.
 */
export const ACCEPTED_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".mkv",
  ".avi",
  ".hevc",
  ".3gp",
] as const;

/** `accept` attribute for the file input. */
export const ACCEPT_ATTRIBUTE = ["video/*", ...ACCEPTED_EXTENSIONS].join(",");

export function hasAcceptedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Safari reports an empty or `application/octet-stream` type for some `.mov`
 * files, so a recognised extension is enough on its own.
 */
export function looksLikeVideo(filename: string, mimeType: string): boolean {
  return mimeType.startsWith("video/") || hasAcceptedExtension(filename);
}

/**
 * Film grain strength for the export, `REEL_GRAIN_STRENGTH` to override.
 * Server-only: client components receive the resolved value as a prop, since
 * Next only inlines `NEXT_PUBLIC_*` into the browser bundle.
 */
export function grainStrength(): number {
  const raw = Number(process.env.REEL_GRAIN_STRENGTH);
  if (!Number.isFinite(raw)) return GRAIN_VIDEO.defaultStrength;
  return Math.min(GRAIN_VIDEO.max, Math.max(GRAIN_VIDEO.min, Math.round(raw)));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
