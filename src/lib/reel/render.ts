import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { renderCardMaskPng, renderConicPng, renderPlatePng } from "./background";
import { FFMPEG_PATH } from "./ffmpeg";
import { jobDir, type ReelJob } from "./jobs";
import { grainStrength } from "./limits";
import { CARD, CONIC, INTRO, REEL_H, REEL_W, WAVEFORM, waveformY } from "./spec";

/** Turns "Client raw clip.MOV" into "client-raw-clip-reel.mp4". */
function downloadNameFor(originalName: string): string {
  const stem = path.parse(originalName).name || "testimonial";
  const slug =
    stem
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "testimonial";
  return `${slug}-reel.mp4`;
}

function parseTimecode(value: string): number | null {
  const m = value.trim().match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Composites the reel:
 *
 *   1. cover-scale + crop the source into the card rect (never letterboxed)
 *   2. punch rounded corners into it with a greyscale matte via `alphamerge`
 *   3. overlay that card onto the static brand plate
 *   4. fade and rise the text layer in over the first 0.6s
 *   5. draw a waveform from the clip's own audio under the stars
 *   6. add per-frame film grain
 *   7. pass the source audio through, re-encoded only to AAC
 *
 * Mutates `job` in place so `GET /api/reel/jobs/:id` can report progress.
 */
export async function renderReel(job: ReelJob): Promise<void> {
  const dir = jobDir(job.id);
  const card = CARD[job.ratio];
  const withAudio = job.probe.hasAudio;

  // The plate is split so the rotating sweep can be composited between the
  // backdrop and the card frame; see `svg.ts` for why those are separate layers.
  const [backdropPng, cardFramePng, textPng, maskPng, conicPng] = await Promise.all([
    renderPlatePng(job.ratio, "backdrop"),
    renderPlatePng(job.ratio, "cardframe"),
    renderPlatePng(job.ratio, "text", job.caption),
    renderCardMaskPng(job.ratio),
    renderConicPng(),
  ]);

  const backdropPath = path.join(dir, "backdrop.png");
  const cardFramePath = path.join(dir, "cardframe.png");
  const textPath = path.join(dir, "text.png");
  const maskPath = path.join(dir, "mask.png");
  const conicPath = path.join(dir, "conic.png");
  const outputPath = path.join(dir, "reel.mp4");

  await Promise.all([
    writeFile(backdropPath, backdropPng),
    writeFile(cardFramePath, cardFramePng),
    writeFile(textPath, textPng),
    writeFile(maskPath, maskPng),
    writeFile(conicPath, conicPng),
  ]);

  // Drive the still inputs at the source frame rate so the output keeps the
  // original cadence instead of being resampled to the image default of 25fps.
  const fps = job.probe.fps.toFixed(5);

  // Eased rise: starts `riseDistance` px low at t=0, settles at 0.
  const riseExpr = `if(lt(t,${INTRO.durationSeconds}),${INTRO.riseDistance}*pow(1-t/${INTRO.durationSeconds},2),0)`;

  const steps = [
    `[0:v]scale=${card.w}:${card.h}:force_original_aspect_ratio=increase,crop=${card.w}:${card.h},setsar=1,format=rgba[vid]`,
    `[4:v]format=gray[mask]`,
    `[vid][mask]alphamerge[cardv]`,

    // The sweep: spin the disc about its own centre, take the window that puts
    // that centre back on the card band, then upscale from half size. Cropping
    // before the scale keeps the per-frame cost on the small image.
    `[5:v]rotate=2*PI*t/${CONIC.periodSeconds}:c=black:ow=iw:oh=ih,` +
      `crop=${CONIC.crop.w}:${CONIC.crop.h}:${CONIC.crop.x}:${CONIC.crop.y},` +
      `scale=${REEL_W}:${REEL_H}:flags=bicubic,format=gbrp[sweep]`,
    // `screen` so the sweep only ever adds light — it cannot darken the plate
    // however bright the arm gets.
    `[1:v]format=gbrp[backdrop]`,
    `[backdrop][sweep]blend=all_mode=screen:shortest=1,format=rgba[lit]`,

    `[2:v]format=rgba[frame]`,
    `[lit][frame]overlay=0:0:shortest=1[bg]`,
    `[bg][cardv]overlay=${card.x}:${card.y}:shortest=1[withvid]`,
    `[3:v]format=rgba,fade=t=in:st=0:d=${INTRO.durationSeconds}:alpha=1[txt]`,
    `[withvid][txt]overlay=0:'${riseExpr}'[withtxt]`,
  ];

  if (withAudio) {
    // Split the audio: one copy drives the waveform, one is encoded out. Using
    // the same input stream for a filter and a direct -map is fragile.
    steps.push(`[0:a]asplit=2[awave][aout]`);
    steps.push(
      // showwaves paints on black; key the black out so only the trace lands.
      `[awave]showwaves=s=${WAVEFORM.width}x${WAVEFORM.height}:mode=${WAVEFORM.mode}:rate=${fps}:colors=${WAVEFORM.color}:scale=${WAVEFORM.scale},format=rgba,colorkey=0x000000:0.22:0.05,fade=t=in:st=0:d=${INTRO.durationSeconds}:alpha=1[wave]`,
    );
    steps.push(
      `[withtxt][wave]overlay=${WAVEFORM.x}:${waveformY(job.ratio)}:shortest=1[composited]`,
    );
  } else {
    steps.push(`[withtxt]null[composited]`);
  }

  // Grain is applied as an `overlay` blend against a mid-grey noise plate rather
  // than with `noise` directly on the picture. Two reasons: it matches the site's
  // CSS `mix-blend-mode: overlay` grain, and overlay scales each deviation by the
  // underlying brightness, so the near-black background stays clean while midtones
  // and the red glow carry the texture — which is how real film grain falls.
  // It is also ~10x cheaper to encode: measured 16 MB per 30s here versus 150 MB
  // for `noise=c0s=12:c0f=t+u`, because temporal noise on flat black is
  // incompressible and x264 at crf 19 faithfully preserves every bit of it.
  const grain = grainStrength();
  steps.push(
    grain > 0
      ? `[6:v]noise=alls=${grain}:allf=t+u,format=gbrp[grain];` +
          `[composited]format=gbrp[graded];` +
          `[graded][grain]blend=all_mode=overlay:shortest=1,format=yuv420p[out]`
      : `[composited]format=yuv420p[out]`,
  );

  const filter = steps.join(";");

  const args = [
    "-hide_banner",
    "-nostdin",
    "-y",
    "-i",
    job.sourcePath,
    ...["-loop", "1", "-framerate", fps, "-i", backdropPath],
    ...["-loop", "1", "-framerate", fps, "-i", cardFramePath],
    ...["-loop", "1", "-framerate", fps, "-i", textPath],
    ...["-loop", "1", "-framerate", fps, "-i", maskPath],
    ...["-loop", "1", "-framerate", fps, "-i", conicPath],
    // Input 6: the grain plate. Only wired up when grain is enabled, since an
    // unused infinite lavfi source would still be decoded every frame.
    ...(grain > 0
      ? ["-f", "lavfi", "-i", `color=c=gray:s=${REEL_W}x${REEL_H}:r=${fps}`]
      : []),
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    ...(withAudio ? ["-map", "[aout]"] : []),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "19",
    "-pix_fmt",
    "yuv420p",
    "-profile:v",
    "high",
    ...(withAudio
      ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"]
      : []),
    "-movflags",
    "+faststart",
    "-shortest",
    "-progress",
    "pipe:1",
    "-nostats",
    "-loglevel",
    "error",
    outputPath,
  ];

  job.status = "rendering";
  job.progress = 0;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(FFMPEG_PATH, args, { windowsHide: true });
    job.process = child;

    let stderr = "";
    let stdoutBuffer = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const [key, rawValue] = line.split("=");
        if (!key || rawValue === undefined) continue;
        const value = rawValue.trim();

        let seconds: number | null = null;
        if (key.trim() === "out_time") seconds = parseTimecode(value);
        else if (key.trim() === "out_time_us") seconds = Number(value) / 1e6;

        if (seconds !== null && Number.isFinite(seconds) && job.probe.durationSeconds > 0) {
          job.progress = Math.min(0.99, Math.max(0, seconds / job.probe.durationSeconds));
        }
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      // Keep only the tail; a failing decode can emit thousands of lines.
      stderr = (stderr + chunk).slice(-4000);
    });

    child.on("error", (err) => {
      reject(new Error(`Could not start FFmpeg (${FFMPEG_PATH}): ${err.message}`));
    });

    child.on("close", (code) => {
      job.process = undefined;
      if (code === 0) {
        resolve();
        return;
      }
      if (/No space left on device/i.test(stderr)) {
        reject(
          new Error(
            "The disk filled up while rendering. Free some space, or set " +
              "REEL_WORK_DIR in .env to a drive with more room.",
          ),
        );
        return;
      }
      const detail = stderr.trim().split("\n").filter(Boolean).slice(-3).join(" · ");
      reject(new Error(detail || `FFmpeg exited with code ${code}.`));
    });
  });

  job.outputPath = outputPath;
  job.downloadName = downloadNameFor(job.originalName);
  job.progress = 1;
  job.status = "done";
}

export { REEL_H, REEL_W };
