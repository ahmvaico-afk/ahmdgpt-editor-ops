/*
 * Ad Resizer: a 9:16 ad placed whole in a 16:9 / 4:5 / 1:1 frame, with the
 * empty sides filled by a blurred, darkened copy of the same ad. Nothing is
 * cropped or stretched. Same look as the local tool in H:\CLAUDE CODE\ad-resizer.
 *
 * Everything runs in the editor's browser (WebCodecs via mediabunny), never on
 * the server: the DigitalOcean box is far too small to re-encode video.
 */

export const AD_FORMATS = {
  "16x9": { label: "16:9", w: 1920, h: 1080 },
  "4x5": { label: "4:5", w: 1080, h: 1350 },
  "1x1": { label: "1:1", w: 1080, h: 1080 },
} as const;

export type AdFormat = keyof typeof AD_FORMATS;
export const AD_FORMAT_KEYS = Object.keys(AD_FORMATS) as AdFormat[];

export interface AdLook {
  /** Blur strength as a % of the frame's short side. */
  blur: number;
  /** How much the blurred sides are darkened, 0–100. */
  dim: number;
}

export const DEFAULT_LOOK: AdLook = { blur: 8, dim: 20 };
export const LOOK_LIMITS = { blur: [2, 20], dim: [0, 60] } as const;

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Scratch = HTMLCanvasElement | OffscreenCanvas;

/** Anything we can paint: an <img>, a <video>, or a decoded video frame. */
export interface AdSource {
  width: number;
  height: number;
  draw: (ctx: Ctx, x: number, y: number, w: number, h: number) => void;
}

export function makeScratch(): Scratch {
  return typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(2, 2)
    : document.createElement("canvas");
}

/** Paints one finished frame of size W×H onto ctx. */
export function drawAd(ctx: Ctx, W: number, H: number, src: AdSource, look: AdLook, scratch: Scratch) {
  const { width: sw, height: sh } = src;

  // Background: blurred at quarter size (looks the same, far cheaper), drawn a
  // little oversized so the blur never fades to transparent at the edges.
  const bw = Math.max(2, Math.round(W / 4));
  const bh = Math.max(2, Math.round(H / 4));
  if (scratch.width !== bw || scratch.height !== bh) {
    scratch.width = bw;
    scratch.height = bh;
  }
  const s = scratch.getContext("2d") as Ctx;
  const sigma = (look.blur / 100) * Math.min(bw, bh);
  const pad = Math.ceil(sigma * 3);
  const cs = Math.max((bw + 2 * pad) / sw, (bh + 2 * pad) / sh);
  s.filter = sigma > 0 ? `blur(${sigma}px)` : "none";
  src.draw(s, (bw - sw * cs) / 2, (bh - sh * cs) / 2, sw * cs, sh * cs);
  s.filter = "none";

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(scratch, 0, 0, W, H);
  if (look.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${look.dim / 100})`;
    ctx.fillRect(0, 0, W, H);
  }

  // The ad itself: fitted whole, never cropped or stretched.
  const fs = Math.min(W / sw, H / sh);
  const fw = Math.round(sw * fs);
  const fh = Math.round(sh * fs);
  src.draw(ctx, Math.round((W - fw) / 2), Math.round((H - fh) / 2), fw, fh);
}

/** "summer ad v2.mp4" + 16x9 → "summer ad v2 16x9.mp4" */
export function adOutputName(fileName: string, fmt: AdFormat, ext: string) {
  const base = fileName.replace(/\.[^.]+$/, "") || "ad";
  return `${base} ${fmt}.${ext}`;
}
