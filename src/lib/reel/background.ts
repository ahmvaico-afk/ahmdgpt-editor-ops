import { existsSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { type ReelRatio } from "./spec";
import {
  SERVER_FONTS,
  buildBackgroundSvg,
  buildCardMaskSvg,
  buildConicSvg,
  type ReelLayer,
} from "./svg";

const FONT_DIR = path.join(process.cwd(), "assets", "reel-fonts");

const FONT_FILES = [
  "Syne-ExtraBold.ttf",
  "Syne-Bold.ttf",
  "JetBrainsMono-Regular.ttf",
  "JetBrainsMono-Medium.ttf",
].map((f) => path.join(FONT_DIR, f));

function fontFiles(): string[] {
  const missing = FONT_FILES.filter((f) => !existsSync(f));
  if (missing.length > 0) {
    throw new Error(
      `Reel brand fonts are missing: ${missing
        .map((f) => path.basename(f))
        .join(", ")}. They should be committed under assets/reel-fonts/.`,
    );
  }
  return FONT_FILES;
}

function rasterise(svg: string, background?: string): Buffer {
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: fontFiles(),
      // Only the committed brand faces — never silently substitute a system font.
      loadSystemFonts: false,
      defaultFontFamily: SERVER_FONTS.display,
    },
    fitTo: { mode: "original" },
    ...(background ? { background } : {}),
  });
  return Buffer.from(resvg.render().asPng());
}

const plateCache = new Map<string, Promise<Buffer>>();

/**
 * Renders one layer of the plate at 1080x1920.
 *
 * `base` comes back opaque (it is the bottom of the stack); `text` keeps its
 * alpha so FFmpeg can fade and slide it in over the composite. Grain is no
 * longer baked in — FFmpeg applies it per frame so it moves like film.
 */
export function renderPlatePng(
  ratio: ReelRatio,
  layer: ReelLayer,
  caption?: string,
): Promise<Buffer> {
  // The caption is per-job, so it has to be part of the key — otherwise the
  // first render's text would be served to every later job at that ratio.
  const key = `${ratio}:${layer}:${caption ?? ""}`;
  let cached = plateCache.get(key);
  if (!cached) {
    cached = (async () => {
      const svg = buildBackgroundSvg(ratio, SERVER_FONTS, { layer, caption });
      return rasterise(svg);
    })().catch((err) => {
      plateCache.delete(key);
      throw err;
    });
    plateCache.set(key, cached);
  }
  return cached;
}

let conicCache: Promise<Buffer> | undefined;

/**
 * The conic sweep disc, rotated per frame by FFmpeg rather than baked in.
 * Ratio-independent — it is centred on the card band, which both ratios share.
 */
export function renderConicPng(): Promise<Buffer> {
  if (!conicCache) {
    conicCache = (async () => rasterise(buildConicSvg(), "#000000"))().catch((err) => {
      conicCache = undefined;
      throw err;
    });
  }
  return conicCache;
}

const maskCache = new Map<ReelRatio, Promise<Buffer>>();

/**
 * Rounded-corner matte for the card. FFmpeg's `alphamerge` reads the second
 * input's luma, so this is emitted as greyscale.
 */
export function renderCardMaskPng(ratio: ReelRatio): Promise<Buffer> {
  let cached = maskCache.get(ratio);
  if (!cached) {
    cached = (async () => {
      const png = rasterise(buildCardMaskSvg(ratio), "#000000");
      return sharp(png).removeAlpha().greyscale().png().toBuffer();
    })().catch((err) => {
      maskCache.delete(ratio);
      throw err;
    });
    maskCache.set(ratio, cached);
  }
  return cached;
}
