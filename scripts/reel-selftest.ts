/**
 * End-to-end check that the reel pipeline works on this machine.
 *
 *   npm run reel:selftest
 *
 * Generates a synthetic portrait and landscape clip (with audio), runs them
 * through the real render path, and verifies the output is 1080x1920 H.264 with
 * the audio still attached. Run this first if a render ever misbehaves — it
 * isolates FFmpeg from the browser and the upload.
 */
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { FFMPEG_PATH, FFPROBE_PATH, probeVideo } from "../src/lib/reel/ffmpeg";
import { createJobDir, discardJob, putJob, type ReelJob } from "../src/lib/reel/jobs";
import { renderReel } from "../src/lib/reel/render";
import { REEL_H, REEL_W, ratioForDimensions } from "../src/lib/reel/spec";

const run = promisify(execFile);

async function makeClip(file: string, size: string, seconds: number) {
  await run(FFMPEG_PATH, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `testsrc2=size=${size}:rate=30`,
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
    "-t", String(seconds),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
    file,
  ]);
}

async function main() {
  console.log(`ffmpeg   ${FFMPEG_PATH}`);
  console.log(`ffprobe  ${FFPROBE_PATH}\n`);

  const tmp = mkdtempSync(path.join(os.tmpdir(), "reel-selftest-"));
  let failures = 0;

  try {
    for (const [label, size, seconds] of [
      ["portrait ", "1080x1920", 10],
      ["landscape", "1920x1080", 6],
    ] as const) {
      const src = path.join(tmp, `${label.trim()}.mp4`);
      await makeClip(src, size, seconds);

      const probe = await probeVideo(src);
      const ratio = ratioForDimensions(probe.width, probe.height);
      const { id } = await createJobDir();

      const job: ReelJob = {
        id,
        createdAt: Date.now(),
        status: "uploaded",
        originalName: `${label.trim()} clip.mp4`,
        sourcePath: src,
        probe,
        ratio,
        progress: 0,
      };
      putJob(job);

      const startedAt = Date.now();
      const ticks: string[] = [];
      const poll = setInterval(() => ticks.push(`${Math.round(job.progress * 100)}%`), 400);
      await renderReel(job);
      clearInterval(poll);
      const elapsed = (Date.now() - startedAt) / 1000;

      const out = await probeVideo(job.outputPath!);
      const problems: string[] = [];
      if (out.width !== REEL_W || out.height !== REEL_H) {
        problems.push(`expected ${REEL_W}x${REEL_H}, got ${out.width}x${out.height}`);
      }
      if (out.videoCodec !== "h264") problems.push(`expected h264, got ${out.videoCodec}`);
      if (!out.hasAudio) problems.push("audio track was dropped");
      if (Math.abs(out.durationSeconds - probe.durationSeconds) > 0.75) {
        problems.push(
          `duration drifted: ${probe.durationSeconds.toFixed(2)}s in, ${out.durationSeconds.toFixed(2)}s out`,
        );
      }

      console.log(
        `${label}  ${probe.width}x${probe.height} ${probe.durationSeconds.toFixed(1)}s -> card ${ratio}`,
      );
      console.log(
        `            ${out.width}x${out.height} ${out.videoCodec}/${out.audioCodec ?? "no audio"} ` +
          `${out.durationSeconds.toFixed(1)}s @${out.fps.toFixed(2)}fps in ${elapsed.toFixed(1)}s ` +
          `(${(probe.durationSeconds / elapsed).toFixed(1)}x realtime)`,
      );
      console.log(`            progress: ${ticks.join(" ") || "(too fast to sample)"}`);

      if (problems.length > 0) {
        failures += 1;
        console.log(`            FAIL: ${problems.join("; ")}`);
      } else {
        console.log("            OK");
      }
      console.log();

      await discardJob(id);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  if (failures > 0) {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("All checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
