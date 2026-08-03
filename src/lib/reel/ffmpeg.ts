import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

const execFileAsync = promisify(execFile);

/**
 * Binaries ship with the app via `@ffmpeg-installer/ffmpeg`, so nothing has to
 * be installed system-wide. `FFMPEG_PATH` / `FFPROBE_PATH` override them if you
 * ever want a newer or hardware-accelerated build.
 */
export const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegInstaller.path;
export const FFPROBE_PATH = process.env.FFPROBE_PATH || ffprobeInstaller.path;

export type ProbeResult = {
  /** Display dimensions, i.e. after rotation metadata is applied. */
  width: number;
  height: number;
  durationSeconds: number;
  fps: number;
  videoCodec: string;
  hasAudio: boolean;
  audioCodec: string | null;
};

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  tags?: Record<string, string>;
  side_data_list?: Array<{ rotation?: number }>;
};

function parseRate(rate: string | undefined): number {
  if (!rate) return 0;
  const [num, den] = rate.split("/").map(Number);
  if (!num || !den) return 0;
  return num / den;
}

function rotationOf(stream: FfprobeStream): number {
  const fromSideData = stream.side_data_list?.find((s) => typeof s.rotation === "number");
  if (fromSideData?.rotation !== undefined) return Math.abs(fromSideData.rotation % 180);
  const tag = stream.tags?.rotate;
  if (tag) return Math.abs(Number(tag) % 180);
  return 0;
}

/** Reads the real dimensions/duration/codecs of an uploaded file. */
export async function probeVideo(filePath: string): Promise<ProbeResult> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      FFPROBE_PATH,
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        filePath,
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    ));
  } catch {
    throw new Error("Could not read this file as video. It may be corrupt or an unsupported format.");
  }

  const parsed = JSON.parse(stdout) as {
    streams?: FfprobeStream[];
    format?: { duration?: string };
  };

  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");

  if (!video || !video.width || !video.height) {
    throw new Error("No video track found in this file.");
  }

  const rotated = rotationOf(video) === 90;
  const width = rotated ? video.height : video.width;
  const height = rotated ? video.width : video.height;

  const duration =
    Number(video.duration) || Number(parsed.format?.duration) || 0;
  const fps = parseRate(video.avg_frame_rate) || parseRate(video.r_frame_rate) || 30;

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Could not determine the length of this video.");
  }

  return {
    width,
    height,
    durationSeconds: duration,
    // Guard against absurd probe values (VFR screen recordings can report huge rates).
    fps: Math.min(Math.max(fps, 1), 120),
    videoCodec: video.codec_name ?? "unknown",
    hasAudio: Boolean(audio),
    audioCodec: audio?.codec_name ?? null,
  };
}
