/**
 * Everything that defines a hook overlay, in one place.
 *
 * The renderer draws straight onto a canvas at HOOK_W x HOOK_H and that same
 * canvas is what gets exported — the preview is not an approximation of the
 * output, it *is* the output, scaled down by CSS. There is deliberately no
 * second DOM implementation to drift out of sync (the reel compositor learned
 * that lesson the hard way; see lib/reel/svg.ts).
 */

/** 9:16, matching the reel compositor and every platform we post to. */
export const HOOK_W = 1080;
export const HOOK_H = 1920;

export type HookFontKey = "sans" | "display" | "mono";
export type HookAlign = "left" | "center" | "right";
export type HookAnchor = "top" | "middle" | "bottom";
/**
 * `block` wraps the whole paragraph in one rounded rect (what our house style
 * does). `line` gives each line its own pill that hugs its width — the other
 * common short-form look. `none` drops the plate for outline-only text.
 */
export type HookPillMode = "block" | "line" | "none";
/**
 * `none` renders exactly what was typed — the default, so casing stays the
 * editor's decision rather than something the tool imposes. The other two are
 * applied at draw time only; the stored text is never rewritten.
 */
export type HookTextCase = "none" | "upper" | "title";

export interface HookConfig {
  fontKey: HookFontKey;
  fontWeight: number;
  /** Cap height in canvas px, so 64 reads the same on every device. */
  fontSize: number;
  /** Fraction of font size; negative tightens. */
  letterSpacing: number;
  lineHeight: number;
  textColor: string;
  textCase: HookTextCase;

  pillMode: HookPillMode;
  pillColor: string;
  /** 0..1. */
  pillOpacity: number;
  pillRadius: number;
  pillPadX: number;
  pillPadY: number;

  strokeColor: string;
  /** 0 disables the outline. */
  strokeWidth: number;

  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;

  align: HookAlign;
  anchor: HookAnchor;
  /** Distance from the anchored edge as a fraction of frame height. */
  offsetPct: number;
  /** Fraction of frame width the text block may occupy before wrapping. */
  maxWidthPct: number;
  /** Emoji size as a multiple of font size. */
  emojiScale: number;
}

/**
 * The house style, matched to the reference hooks: white rounded plates hugging
 * each line, set in heavy near-black grotesque caps, centred in the upper third,
 * with the emoji riding inline at the end of the last line.
 *
 * Per-line rather than one block because the reference hooks step in at the
 * shorter line — the plate follows the text, it isn't a banner behind it.
 *
 * Kept as the built-in default preset — editors start here and tweak from it.
 */
export const HOUSE_STYLE: HookConfig = {
  fontKey: "sans",
  fontWeight: 800,
  // Sized against the reference hook: "SHE ALMOST DIED FROM SOMETHING HER"
  // has to land on one line, which it does at 42 (869px of the 898px a
  // 0.88 max-width leaves once padding is taken out) and wraps at 44.
  fontSize: 42,
  letterSpacing: -0.01,
  lineHeight: 1.34,
  textColor: "#000000",
  // As typed. The reference hooks are in caps, but that's a per-hook call the
  // editor makes with the Caps control — not something to force on every line.
  textCase: "none",

  pillMode: "line",
  pillColor: "#ffffff",
  pillOpacity: 1,
  pillRadius: 18,
  pillPadX: 26,
  // Deep enough that consecutive plates overlap slightly and read as one
  // stepped shape, the way the reference hooks do, rather than as separate bars.
  pillPadY: 19,

  strokeColor: "#000000",
  strokeWidth: 0,

  shadowColor: "#000000",
  shadowBlur: 0,
  shadowOffsetY: 0,

  align: "center",
  anchor: "top",
  offsetPct: 0.11,
  maxWidthPct: 0.88,
  emojiScale: 1,
};

export const DEFAULT_PRESET_NAME = "AHMD.GPT House Style";

/** Sample copy for an untouched editor, so the preview is never an empty box. */
export const SAMPLE_HOOK_TEXT = "She almost died from something her doctor never checked 😳⚠️";

export const HOOK_FONT_LABELS: Record<HookFontKey, string> = {
  sans: "Inter — house hook font",
  display: "Syne — brand display",
  mono: "JetBrains Mono — brand mono",
};

/** Bounds the UI enforces and the API re-checks; keeps a bad number off the canvas. */
export const HOOK_LIMITS = {
  fontSize: { min: 20, max: 160 },
  fontWeight: { min: 400, max: 900 },
  letterSpacing: { min: -0.1, max: 0.4 },
  lineHeight: { min: 0.85, max: 2.2 },
  pillRadius: { min: 0, max: 120 },
  pillPadX: { min: 0, max: 160 },
  pillPadY: { min: 0, max: 160 },
  pillOpacity: { min: 0, max: 1 },
  strokeWidth: { min: 0, max: 24 },
  shadowBlur: { min: 0, max: 80 },
  shadowOffsetY: { min: -60, max: 60 },
  offsetPct: { min: 0, max: 0.9 },
  maxWidthPct: { min: 0.3, max: 1 },
  emojiScale: { min: 0.5, max: 2 },
  textLength: 300,
  presetName: 60,
} as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const HEX = /^#[0-9a-f]{6}$/i;

function colour(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}

/**
 * Coerces anything (a stored JSON blob, a request body, an older preset written
 * before a field existed) into a complete, in-range config. The renderer and
 * the API both go through this, so neither has to trust its input.
 */
export function normalizeConfig(input: unknown): HookConfig {
  // `uppercase` is the retired boolean, still present in presets saved earlier.
  const raw = (input ?? {}) as Partial<Record<keyof HookConfig, unknown>> & {
    uppercase?: unknown;
  };
  const d = HOUSE_STYLE;
  const L = HOOK_LIMITS;
  const num = (v: unknown, fallback: number, min: number, max: number) =>
    clamp(typeof v === "number" ? v : Number(v ?? fallback), min, max);

  const fontKey: HookFontKey =
    raw.fontKey === "display" || raw.fontKey === "mono" || raw.fontKey === "sans"
      ? raw.fontKey
      : d.fontKey;
  const pillMode: HookPillMode =
    raw.pillMode === "line" || raw.pillMode === "none" || raw.pillMode === "block"
      ? raw.pillMode
      : d.pillMode;
  const align: HookAlign =
    raw.align === "left" || raw.align === "right" || raw.align === "center"
      ? raw.align
      : d.align;
  const anchor: HookAnchor =
    raw.anchor === "middle" || raw.anchor === "bottom" || raw.anchor === "top"
      ? raw.anchor
      : d.anchor;
  const textCase: HookTextCase =
    raw.textCase === "upper" || raw.textCase === "title" || raw.textCase === "none"
      ? raw.textCase
      : // Presets saved before casing became a three-way choice carried a
        // boolean instead; honour it so nobody's saved look changes silently.
        raw.uppercase === true
        ? "upper"
        : d.textCase;

  return {
    fontKey,
    // Rounded to the nearest 100 so the weight always maps to a loaded face.
    fontWeight:
      Math.round(num(raw.fontWeight, d.fontWeight, L.fontWeight.min, L.fontWeight.max) / 100) * 100,
    fontSize: Math.round(num(raw.fontSize, d.fontSize, L.fontSize.min, L.fontSize.max)),
    letterSpacing: num(raw.letterSpacing, d.letterSpacing, L.letterSpacing.min, L.letterSpacing.max),
    lineHeight: num(raw.lineHeight, d.lineHeight, L.lineHeight.min, L.lineHeight.max),
    textColor: colour(raw.textColor, d.textColor),
    textCase,

    pillMode,
    pillColor: colour(raw.pillColor, d.pillColor),
    pillOpacity: num(raw.pillOpacity, d.pillOpacity, L.pillOpacity.min, L.pillOpacity.max),
    pillRadius: Math.round(num(raw.pillRadius, d.pillRadius, L.pillRadius.min, L.pillRadius.max)),
    pillPadX: Math.round(num(raw.pillPadX, d.pillPadX, L.pillPadX.min, L.pillPadX.max)),
    pillPadY: Math.round(num(raw.pillPadY, d.pillPadY, L.pillPadY.min, L.pillPadY.max)),

    strokeColor: colour(raw.strokeColor, d.strokeColor),
    strokeWidth: num(raw.strokeWidth, d.strokeWidth, L.strokeWidth.min, L.strokeWidth.max),

    shadowColor: colour(raw.shadowColor, d.shadowColor),
    shadowBlur: num(raw.shadowBlur, d.shadowBlur, L.shadowBlur.min, L.shadowBlur.max),
    shadowOffsetY: num(raw.shadowOffsetY, d.shadowOffsetY, L.shadowOffsetY.min, L.shadowOffsetY.max),

    align,
    anchor,
    offsetPct: num(raw.offsetPct, d.offsetPct, L.offsetPct.min, L.offsetPct.max),
    maxWidthPct: num(raw.maxWidthPct, d.maxWidthPct, L.maxWidthPct.min, L.maxWidthPct.max),
    emojiScale: num(raw.emojiScale, d.emojiScale, L.emojiScale.min, L.emojiScale.max),
  };
}

/** Filename-safe stem for the exported PNG, derived from the hook text. */
export function hookFileName(text: string): string {
  const slug =
    text
      .toLowerCase()
      // Strips emoji and punctuation alike — anything not a-z0-9 becomes a dash.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "hook";
  return `${slug}-hook.png`;
}
