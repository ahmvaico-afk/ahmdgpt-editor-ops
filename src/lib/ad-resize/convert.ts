import { AD_FORMATS, adOutputName, drawAd, makeScratch, type AdFormat, type AdLook } from "./render";

export const IMAGE_RE = /\.(png|jpe?g|webp|bmp|gif)$/i;
export const VIDEO_RE = /\.(mp4|mov|m4v|webm|mkv)$/i;
/** Longer than any ad; past this the finished file gets too big to hold in the tab. */
export const MAX_SECONDS = 10 * 60;

export function isImageFile(f: File) {
  return f.type.startsWith("image/") || IMAGE_RE.test(f.name);
}
export function isVideoFile(f: File) {
  return f.type.startsWith("video/") || VIDEO_RE.test(f.name);
}

/** A failure we can explain to an editor in one plain sentence. */
export class AdResizeError extends Error {}

export interface AdResult {
  blob: Blob;
  name: string;
}

/** Can this browser re-encode video at all? (Chrome / Edge on a computer: yes.) */
export async function canConvertVideo() {
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return false;
  try {
    const { canEncodeVideo } = await import("mediabunny");
    return await canEncodeVideo("avc", { width: 1920, height: 1080 });
  } catch {
    return false;
  }
}

export async function convertImage(file: File, fmt: AdFormat, look: AdLook): Promise<AdResult> {
  const { w: W, h: H } = AD_FORMATS[fmt];
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new AdResizeError("This image can't be opened. Save it again as PNG or JPG and retry.");
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const src = {
      width: bmp.width,
      height: bmp.height,
      draw: (c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number) =>
        c.drawImage(bmp, x, y, w, h),
    };
    drawAd(ctx, W, H, src, look, makeScratch());
    const jpg = /\.jpe?g$/i.test(file.name) || file.type === "image/jpeg";
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, jpg ? "image/jpeg" : "image/png", 0.95)
    );
    if (!blob) throw new AdResizeError("Your browser ran out of memory making this image. Close some tabs and retry.");
    return { blob, name: adOutputName(file.name, fmt, jpg ? "jpg" : "png") };
  } finally {
    bmp.close();
  }
}

export async function convertVideo(
  file: File,
  fmt: AdFormat,
  look: AdLook,
  onProgress: (p: number) => void
): Promise<AdResult> {
  const mb = await import("mediabunny");
  const { w: W, h: H } = AD_FORMATS[fmt];

  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) });
  try {
    let track;
    try {
      track = await input.getPrimaryVideoTrack();
    } catch {
      throw new AdResizeError("This file can't be read. Export it again as an MP4 and retry.");
    }
    if (!track) throw new AdResizeError("There's no video in this file.");
    const seconds = await input.computeDuration();
    if (seconds > MAX_SECONDS) {
      throw new AdResizeError("This video is over 10 minutes. The resizer is made for ads; trim it first.");
    }

    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }),
      target: new mb.BufferTarget(),
    });
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext("2d")!;
    const scratch = makeScratch();

    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        codec: "avc",
        quality: new mb.Quality("very-high"),
        // Bake any phone rotation into the pixels so players can't flip our frame.
        allowTransformationMetadata: false,
        processedWidth: W,
        processedHeight: H,
        process: (sample) => {
          drawAd(
            ctx,
            W,
            H,
            {
              width: sample.displayWidth,
              height: sample.displayHeight,
              draw: (c, x, y, w, h) => sample.draw(c, x, y, w, h),
            },
            look,
            scratch
          );
          return canvas;
        },
      },
      // AAC is copied untouched; anything else (raw MOV audio, Opus) becomes AAC,
      // because ads managers and phones choke on PCM inside an MP4.
      audio: { codec: "aac" },
    });

    if (!conversion.isValid || conversion.discardedTracks.some((d) => d.reason !== "discarded_by_user")) {
      const lost = conversion.discardedTracks.find((d) => d.reason !== "discarded_by_user");
      const isAudio = lost?.track.isAudioTrack();
      if (lost && isAudio) {
        // Never hand back a silent ad without saying so.
        throw new AdResizeError(
          "The sound in this video can't be converted in the browser. Export it again as an MP4 with AAC audio and retry."
        );
      }
      throw new AdResizeError(
        "Your browser can't read this video's format (often iPhone HEVC). Export it again as an H.264 MP4 and retry."
      );
    }

    conversion.onProgress = (p) => onProgress(Math.min(0.99, p));
    await conversion.execute();
    const buf = output.target.buffer;
    if (!buf || !buf.byteLength) throw new AdResizeError("Nothing came out of the conversion. Please retry.");
    return { blob: new Blob([buf], { type: "video/mp4" }), name: adOutputName(file.name, fmt, "mp4") };
  } finally {
    input.dispose();
  }
}

/** Turns anything thrown into a sentence an editor can act on. */
export function friendlyError(e: unknown) {
  if (e instanceof AdResizeError) return e.message;
  const msg = e instanceof Error ? e.message : String(e);
  if (/memory|allocation|QuotaExceeded/i.test(msg)) {
    return "Your computer ran out of memory. Close other tabs and convert fewer files at once.";
  }
  if (/codec|decod|unsupported|not supported/i.test(msg)) {
    return "Your browser can't read this video's format. Export it again as an H.264 MP4 and retry.";
  }
  return "Something went wrong with this file. Re-export it as an MP4 and retry. If it keeps failing, send it to Ahmed.";
}
