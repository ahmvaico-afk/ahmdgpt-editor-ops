/**
 * The testimonial-reel composition, expressed once in 1080x1920 output pixels.
 *
 * Both renderers consume this module, so the live preview and the exported MP4
 * cannot drift apart:
 *   - `components/reel/reel-composition.tsx` lays the preview out in the DOM
 *   - `lib/reel/background.ts` emits the SVG that becomes the baked PNG
 *
 * Colours mirror the `@theme` block in `src/app/globals.css` (the login screen's
 * tokens). Change one, change the other.
 */

export const REEL_W = 1080;
export const REEL_H = 1920;

export type ReelRatio = "9x16" | "16x9";

export const REEL_RATIOS: ReelRatio[] = ["9x16", "16x9"];

/** Mirrors `--color-*` in globals.css. */
export const PALETTE = {
  bg: "#0a0a0c",
  text: "#f2edee",
  muted: "#8a7c7e",
  muted2: "#5a4a4d",
  accent: "#ff2a3c",
  accentLight: "#ff5a68",
  iris: "#1a1830",
  pupil: "#080808",
} as const;

/** Family names as browsers see them, via `@font-face` / next/font. */
export const FONT_DISPLAY = "Syne";
export const FONT_MONO = "JetBrains Mono";

/**
 * The family names actually inside `assets/reel-fonts/*.ttf`, which is what
 * resvg matches on. They are not `FONT_DISPLAY`/`FONT_MONO`: these files name
 * most weights as their own family.
 *
 *   Syne-ExtraBold.ttf        -> "Syne ExtraBold" / Regular
 *   Syne-Bold.ttf             -> "Syne"           / Bold
 *   JetBrainsMono-Regular.ttf -> "JetBrains Mono" / Regular
 *   JetBrainsMono-Medium.ttf  -> "JetBrains Mono Medium" / Regular
 *
 * Asking resvg for `font-family="Syne" font-weight="800"` therefore matched
 * only Syne *Bold*, and every display run in the export rendered ~1.5x narrower
 * than the browser preview and than `LOGO.textWidth`. Browsers are unaffected
 * because `@font-face` registers every weight under one family.
 */
export const SERVER_FAMILY: Record<string, string> = {
  "display:800": "Syne ExtraBold",
  "display:700": "Syne",
  "mono:500": "JetBrains Mono Medium",
  "mono:400": "JetBrains Mono",
};

/**
 * JetBrains Mono is monospaced at 600/1000 em, so mono runs can be measured
 * exactly. SVG and CSS both add letter-spacing *after* the final glyph, so the
 * trailing gap is subtracted here and the text is positioned from its left edge
 * in both renderers rather than relying on centring.
 */
export const MONO_ADVANCE = 0.6;

export function monoWidth(text: string, fontSize: number, tracking: number): number {
  if (text.length === 0) return 0;
  const advance = MONO_ADVANCE * fontSize + tracking * fontSize;
  return text.length * advance - tracking * fontSize;
}

/**
 * Wordmark row: eye glyph + AHMD.GPT.
 *
 * `textWidth` is the summed hmtx advance of "AHMD.GPT" in Syne ExtraBold at
 * this size and tracking, measured from `assets/reel-fonts/Syne-ExtraBold.ttf`.
 * Hardcoding it lets the DOM and the SVG place the row from the same left edge
 * instead of each renderer centring the mixed icon+text row on its own.
 */
export const LOGO = {
  top: 100,
  // The brand lockup runs the eye at ~1.75x the wordmark size and gaps it at
  // ~0.55x: login is h-8 (32px) + text-lg (18px) + gap-2.5, the admin header is
  // h-6 (24px) + text-sm (14px) + gap-2. Both land on the same proportions.
  eyeSize: 74,
  gap: 23,
  fontSize: 42,
  tracking: -0.02,
  text: "AHMD.GPT",
  textWidth: 384.43,
  /** Syne's cap height is ~0.7em, so half of it re-centres the baseline. */
  capHeightRatio: 0.35,
} as const;

/** Mono status line with the pulsing dot. */
export const STATUS = {
  baseline: 214,
  fontSize: 21,
  tracking: 0.2,
  dotRadius: 6.5,
  ringRadius: 13,
  gap: 18,
  text: "WHAT THEY SAY — LIVE",
} as const;

/**
 * Two-line Syne headline; `line2Accent` carries the red glow.
 *
 * Size is bounded by the longest line: "What they say" is 11.596em of advance
 * in Syne ExtraBold, so the rendered width is
 *   11.596 * size + tracking * size * 12
 * At 90px with -0.045em that lands at ~995px, leaving ~42px of side margin on
 * the 1080px canvas. Going much past this starts crowding the frame edge, where
 * Instagram and TikTok can crop.
 */
export const HEADLINE = {
  fontSize: 90,
  lineHeight: 82,
  tracking: -0.045,
  line1Baseline: 336,
  line2Baseline: 418,
  line1: "What they say",
  line2Lead: "about ",
  line2Accent: "me.",
  glowBlur: 18,
} as const;

/** Vertical band the video card is centred inside. */
export const BAND = { top: 520, height: 1136 } as const;

/**
 * The stars and waveform hang off the bottom of the card rather than sitting at
 * fixed heights. With absolute positions tuned for the tall 9:16 card, a 16:9
 * card left them stranded ~370px below it and bunched against the footer, with
 * a matching void above the card. These offsets reproduce the 9:16 layout
 * exactly (card bottom 1656 -> stars 1706, waveform 1742) and follow the card up
 * when it is shorter.
 */
export const CAPTION_OFFSET = 50;
export const WAVEFORM_OFFSET = 86;
export const WAVEFORM_HEIGHT = 56;

/** Declared here so the 16:9 card can balance itself against it; see CARD. */
export const FOOTER_BASELINE = 1846;

/**
 * Card geometry per source ratio. Every value is even so that chroma
 * subsampling in yuv420p lands on clean boundaries and FFmpeg's `overlay`
 * doesn't shift colour by half a pixel.
 *
 * 9:16 fills the band's full height.
 *
 * 16:9 is the awkward one: a landscape clip is short, so the old fixed 880x496
 * centred on the band left the frame looking half empty. Two changes fix that —
 * the card is 960x540 (exactly 16:9, both even) so it reads at the same weight
 * as the headline above it, and what gets centred is the whole card-plus-caption
 * group, balanced between the headline and the footer rather than inside a band
 * whose height was chosen for the tall card.
 */
/** Headline's last baseline to the first caption baseline (16:9). */
export const HEADLINE_TO_CAPTION = 62;
/** Last caption baseline to the top of the card (16:9). */
export const CAPTION_TO_CARD = 56;

/**
 * How far the 16:9 type block slides down from its 9:16 position.
 *
 * 9:16 fills the frame on its own, so it keeps the fixed positions and this is
 * 0. 16:9 is short, and pinning the type to the top left a void between the
 * headline and the card. Instead the whole stack — logo, status, headline,
 * caption, card, stars, waveform — is treated as one group and centred in the
 * frame, which puts the headline directly above the video and the wordmark
 * above that. The footer stays pinned to the frame, so it is excluded.
 */
export const CARD: Record<ReelRatio, { x: number; y: number; w: number; h: number }> = (() => {
  const wide = { x: 60, w: 960, h: 540 };
  // Positions before the shift, measured off the shared headline baseline.
  const relCardTop = HEADLINE.line2Baseline + HEADLINE_TO_CAPTION + CAPTION_TO_CARD;
  const relWaveBottom = relCardTop + wide.h + WAVEFORM_OFFSET + WAVEFORM_HEIGHT;
  const groupHeight = relWaveBottom - LOGO.top;
  const contentBottom = FOOTER_BASELINE - 18;
  // Even, so chroma subsampling lands on clean boundaries.
  const offset =
    Math.round(((contentBottom - groupHeight) / 2 - LOGO.top) / 2) * 2;
  return {
    "9x16": { x: 220, y: BAND.top, w: 640, h: BAND.height },
    "16x9": { ...wide, y: relCardTop + offset },
  };
})();

/** Vertical shift applied to the 16:9 type block; 0 for 9:16. See CARD. */
export function stackOffset(ratio: ReelRatio): number {
  if (ratio !== "16x9") return 0;
  return CARD["16x9"].y - (HEADLINE.line2Baseline + HEADLINE_TO_CAPTION + CAPTION_TO_CARD);
}

/** Centre of the star row, hung off the bottom of the card. */
export function captionCenterY(ratio: ReelRatio): number {
  const card = CARD[ratio];
  return card.y + card.h + CAPTION_OFFSET;
}

/** Top of the waveform strip, hung off the bottom of the card. */
export function waveformY(ratio: ReelRatio): number {
  const card = CARD[ratio];
  return card.y + card.h + WAVEFORM_OFFSET;
}

/**
 * Optional per-reel caption — a client name, handle or short quote — sitting in
 * the gap between the headline and the card.
 *
 * 16:9 only: that layout leaves ~354px there, whereas 9:16 leaves 80px, which
 * cannot hold a line without shrinking the card. `captionLines` returns [] for
 * 9:16 so callers need no special case.
 *
 * Set in JetBrains Mono rather than the display face because it is monospaced,
 * so `monoWidth` measures it exactly and the wrap is identical in the browser
 * and in resvg. Wrapping proportional Syne would need a metrics table.
 */
export const CAPTION_TEXT = {
  fontSize: 26,
  tracking: 0.16,
  lineHeight: 40,
  maxLines: 2,
  /** Wrap width; narrower than the card so it reads as a caption, not a block. */
  maxWidth: 820,
  /** Hard cap on stored input, independent of wrapping. */
  maxChars: 120,
  opacity: 0.72,
} as const;

/**
 * Greedy word wrap to at most `maxLines`, ellipsising the last line if the text
 * still does not fit. Returns [] when there is nothing to draw.
 */
export function captionLines(ratio: ReelRatio, text: string | undefined): string[] {
  if (ratio !== "16x9") return [];
  const clean = (text ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!clean) return [];

  const { fontSize, tracking, maxWidth, maxLines } = CAPTION_TEXT;
  const fits = (s: string) => monoWidth(s, fontSize, tracking) <= maxWidth;

  const lines: string[] = [];
  let line = "";
  for (const word of clean.slice(0, CAPTION_TEXT.maxChars).split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  // Anything that still overflows gets trimmed a character at a time.
  const last = lines[lines.length - 1];
  if (last && !fits(last)) {
    let trimmed = last;
    while (trimmed.length > 1 && !fits(`${trimmed}…`)) trimmed = trimmed.slice(0, -1);
    lines[lines.length - 1] = `${trimmed}…`;
  }
  return lines;
}

/**
 * Baselines for the wrapped caption. Anchored to the top of the card and
 * stacked upwards, so extra lines push the caption up towards the headline
 * rather than shifting the card.
 */
export function captionBaselines(lineCount: number): number[] {
  if (lineCount === 0) return [];
  const last = CARD["16x9"].y - CAPTION_TO_CARD;
  return Array.from(
    { length: lineCount },
    (_, i) => last - (lineCount - 1 - i) * CAPTION_TEXT.lineHeight,
  );
}

export const CARD_RADIUS = 40;
export const CARD_BEZEL = 3;
export const CARD_GLOW_BLUR = 44;

/**
 * A conic sweep of light rotating behind the card — the one moving element in
 * the backdrop. It is screen-blended, so it only ever adds light and can never
 * muddy the near-black background.
 *
 * The disc is centred on the card band rather than the frame, so the sweep
 * appears to orbit the video. `radius` reaches the farthest frame corner from
 * that centre, which is why there is no visible disc edge.
 *
 * It is authored well below output resolution: the gradient carries no detail
 * above a couple of cycles per frame, so rotating a small disc and upscaling on
 * the way out is visually indistinguishable from doing it at 1080x1920. Any
 * residual banding is buried by the grain pass. See `downscale`.
 */
export const CONIC = (() => {
  const cx = REEL_W / 2;
  const cy = BAND.top + BAND.height / 2;
  // Farthest corner from the centre; the top two are always the far ones since
  // the band sits below the midline.
  const radius = Math.ceil(Math.hypot(cx, cy) / 2) * 2;
  /**
   * How far below output resolution the sweep is rasterised and rotated.
   *
   * Measured, not assumed: going from 2 to 4 changed a 12s render by 0.5s out
   * of 49s, so the rotate is not where the time goes — the cost of the sweep is
   * the full-frame screen blend and the extra bits a moving background costs
   * x264. Since raising it buys no speed, it is set for quality margin instead.
   */
  const downscale = 2;
  const canvas = (radius * 2) / downscale;
  return {
    cx,
    cy,
    radius,
    canvas,
    downscale,
    /** Crop, in working-scale pixels, that lands the disc centre on (cx, cy). */
    crop: {
      x: canvas / 2 - cx / downscale,
      y: canvas / 2 - cy / downscale,
      w: REEL_W / downscale,
      h: REEL_H / downscale,
    },
    /** Seconds per full turn. Slow enough to read as ambient, not a spinner. */
    periodSeconds: 18,
    /** Angular slices approximating the gradient. 240 -> 1.5 deg, seam-free. */
    wedges: 240,
    /** Peak alpha of the leading arm before the radial falloff. */
    peakOpacity: 0.45,
    /** Trailing arm opposite the lead, for balance. */
    tailWeight: 0.35,
    /** Higher = tighter arm. */
    leadFalloff: 2.2,
    tailFalloff: 3,
    /** Fraction of the radius where the sweep has faded to nothing. */
    fadeStart: 0.12,
    fadeEnd: 0.95,
  };
})();

/**
 * ★★★★★, sitting above the waveform. There is deliberately no caption text.
 *
 * Neither Syne nor JetBrains Mono contains U+2605, so the stars are drawn as
 * geometry (see `starPath`) rather than typed as a character. In the browser a
 * fallback font would silently supply a differently-shaped star; on the server
 * it would render as .notdef.
 */
export const CAPTION = {
  starOuter: 18,
  starInner: 18 * 0.382,
  starGap: 12,
  starCount: 5,
} as const;

/**
 * Live audio waveform, drawn by FFmpeg's `showwaves` straight from the clip's
 * own audio, so it moves with the client's voice. Skipped entirely when the
 * source has no audio track — the stars then stand alone.
 */
export const WAVEFORM = {
  width: 440,
  height: WAVEFORM_HEIGHT,
  x: (REEL_W - 440) / 2,
  color: PALETTE.accent,
  /**
   * Cube-root amplitude scaling. Speech is quiet relative to full scale, so
   * `lin` renders a near-flat line and even `sqrt` sits low in the strip;
   * `cbrt` lifts normal speaking level to fill it.
   */
  scale: "cbrt",
  /** Centred trace, mirrored about the midline. */
  mode: "cline",
} as const;

/** Logo, headline and stars fade and rise into place, then hold. */
export const INTRO = {
  durationSeconds: 0.6,
  /** Pixels below final position at t=0, eased out. */
  riseDistance: 18,
} as const;

/**
 * Grain regenerates every frame so it moves like real film instead of sitting
 * frozen, and is composited as an `overlay` blend against a mid-grey noise
 * plate — the same operation as the site's CSS grain. See `render.ts` for why
 * overlay rather than noising the picture directly.
 *
 * The strength here is the deviation on that grey plate, so it is NOT the same
 * scale as a bare `noise=c0s=` value: overlay attenuates it by the underlying
 * brightness, leaving deep blacks clean and putting the texture in the midtones
 * and the red glow.
 */
export const GRAIN_VIDEO = {
  /**
   * Off. Set `REEL_GRAIN_STRENGTH` to bring it back — measured on a 9:16
   * export, ~12 reads as barely there, 20 is a tasteful 35mm texture, past 30
   * goes heavy 16mm, and 20 costs roughly 12 MB per 30s.
   */
  defaultStrength: 0,
  min: 0,
  max: 60,
} as const;

/** Preview opacity that reads about the same as a given export strength. */
export function grainPreviewOpacity(strength: number): number {
  return Math.min(0.16, Math.max(0, strength * 0.006));
}

export const FOOTER = {
  baseline: FOOTER_BASELINE,
  fontSize: 18,
  tracking: 0.42,
  opacity: 0.1,
  text: "AHMD.GPT",
} as const;

/** Replicates `.bg-accent-glow` (a bottom-anchored, farthest-corner ellipse). */
export const BOTTOM_GLOW = (() => {
  const boxHeight = REEL_H * 0.6;
  const halfW = REEL_W / 2;
  return {
    cx: halfW,
    cy: REEL_H,
    // CSS `ellipse at 50% 100%` with the default farthest-corner sizing.
    rx: halfW * Math.SQRT2,
    ry: boxHeight * Math.SQRT2,
  };
})();

/** Matches `--grain-*` in globals.css. */
export const GRAIN = {
  tile: 140,
  baseFrequency: 0.9,
  numOctaves: 2,
  opacity: 0.035,
} as const;

/** Left edges for the eye + wordmark row, centred as one unit. */
export function logoMetrics() {
  const total = LOGO.eyeSize + LOGO.gap + LOGO.textWidth;
  const left = (REEL_W - total) / 2;
  return {
    total,
    left,
    eyeLeft: left,
    textLeft: left + LOGO.eyeSize + LOGO.gap,
    /** Wordmark baseline, optically centred against the eye. */
    textBaseline: LOGO.top + LOGO.eyeSize / 2 + LOGO.fontSize * LOGO.capHeightRatio,
  };
}

/** Left edges for the status dot + mono label, centred as one unit. */
export function statusMetrics() {
  const dotBox = STATUS.ringRadius * 2;
  const textWidth = monoWidth(STATUS.text, STATUS.fontSize, STATUS.tracking);
  const total = dotBox + STATUS.gap + textWidth;
  const left = (REEL_W - total) / 2;
  return {
    total,
    left,
    textWidth,
    dotCx: left + STATUS.ringRadius,
    textLeft: left + dotBox + STATUS.gap,
  };
}

/** Centred run of stars. */
export function captionMetrics() {
  const starsWidth =
    CAPTION.starCount * (CAPTION.starOuter * 2) + (CAPTION.starCount - 1) * CAPTION.starGap;
  return { starsWidth, left: (REEL_W - starsWidth) / 2 };
}

/** Five-pointed star as an SVG path, centred on (cx, cy), one point up. */
export function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (-90 + i * 36) * (Math.PI / 180);
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

/** Rounded-rect path, used for the card mask and the bezel. */
export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): string {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M${x + radius},${y}`,
    `H${x + w - radius}`,
    `A${radius},${radius} 0 0 1 ${x + w},${y + radius}`,
    `V${y + h - radius}`,
    `A${radius},${radius} 0 0 1 ${x + w - radius},${y + h}`,
    `H${x + radius}`,
    `A${radius},${radius} 0 0 1 ${x},${y + h - radius}`,
    `V${y + radius}`,
    `A${radius},${radius} 0 0 1 ${x + radius},${y}`,
    "Z",
  ].join(" ");
}

/** Picks the card shape a source video should be composited into. */
export function ratioForDimensions(width: number, height: number): ReelRatio {
  return height >= width ? "9x16" : "16x9";
}

export function ratioLabel(ratio: ReelRatio): string {
  return ratio === "9x16" ? "9:16" : "16:9";
}
