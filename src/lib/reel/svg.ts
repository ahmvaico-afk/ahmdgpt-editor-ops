/**
 * The reel background as SVG. Deliberately free of Node imports so the browser
 * can render the exact same markup for the live preview that resvg rasterises
 * into the exported MP4 — there is no second layout implementation to drift.
 *
 * It renders in layers because the export animates them separately:
 *   - `base` (opaque)  bottom glow, card glow, card well, bezel — never moves
 *   - `text` (alpha)   logo, status, headline, stars, footer — intros in
 *   - `all`            both, for the browser preview
 *
 * Fonts are the only thing that differs between browser and server: on the
 * server the families are the names resvg registers from the committed TTFs, in
 * the browser they are the `next/font` CSS variables from `globals.css`.
 */
import {
  BOTTOM_GLOW,
  CAPTION,
  CAPTION_TEXT,
  CARD,
  CARD_BEZEL,
  CARD_GLOW_BLUR,
  CARD_RADIUS,
  CONIC,
  FONT_DISPLAY,
  FONT_MONO,
  FOOTER,
  GRAIN,
  HEADLINE,
  LOGO,
  PALETTE,
  REEL_H,
  REEL_W,
  SERVER_FAMILY,
  STATUS,
  WAVEFORM,
  captionBaselines,
  captionCenterY,
  captionLines,
  captionMetrics,
  logoMetrics,
  monoWidth,
  roundedRectPath,
  starPath,
  stackOffset,
  statusMetrics,
  waveformY,
  type ReelRatio,
} from "./spec";

export type FontChoice = {
  /** Family browsers resolve, via `@font-face` / next/font. */
  display: string;
  mono: string;
  /** Optional CSS override applied via `style`, which wins in the browser. */
  displayCss?: string;
  monoCss?: string;
  /**
   * Per-role, per-weight family overrides keyed `role:weight`, for renderers
   * that match on the family name baked into the TTF rather than on a
   * `@font-face` registration. See `SERVER_FAMILY`.
   */
  familyByWeight?: Record<string, string>;
};

/**
 * `backdrop` and `cardframe` are `base` split in two, so the rotating conic
 * sweep can be composited between them — behind the card, in front of the
 * background. `base` is kept as the union for any consumer that wants a single
 * static plate.
 */
export type ReelLayer = "all" | "base" | "backdrop" | "cardframe" | "text";

export const SERVER_FONTS: FontChoice = {
  display: FONT_DISPLAY,
  mono: FONT_MONO,
  familyByWeight: SERVER_FAMILY,
};

/**
 * Browser preview. Points at the `ReelDisplay`/`ReelMono` faces declared in
 * `globals.css`, which load the same TTF files resvg uses — not the next/font
 * copies, whose metrics are not guaranteed to match and would let the preview
 * and the export disagree on text width.
 */
export const BROWSER_FONTS: FontChoice = {
  display: FONT_DISPLAY,
  mono: FONT_MONO,
  // Unquoted deliberately: these go into `style="font-family:..."`, so a quoted
  // value would close the attribute and silently drop the declaration. Safe
  // because both names are single words needing no CSS quoting.
  displayCss: "ReelDisplay",
  monoCss: "ReelMono",
  familyByWeight: SERVER_FAMILY,
};

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fontAttrs(fonts: FontChoice, role: "display" | "mono", weight: number): string {
  const css = role === "display" ? fonts.displayCss : fonts.monoCss;
  const family =
    fonts.familyByWeight?.[`${role}:${weight}`] ??
    (role === "display" ? fonts.display : fonts.mono);
  const style = css ? ` style="font-family:${css}"` : "";
  return `font-family="${family}" font-weight="${weight}"${style}`;
}

/** The eye mark from `components/eye-logo.tsx`, scaled off its 28x28 viewBox. */
function eyeSvg(x: number, y: number, size: number): string {
  const s = size / 28;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M3 14 Q14 5 25 14 Q14 23 3 14 Z" fill="none" stroke="${PALETTE.text}" stroke-width="1.4"/>
    <circle cx="14" cy="14" r="4.2" fill="${PALETTE.iris}" stroke="${PALETTE.text}" stroke-width="1.2"/>
    <circle cx="14" cy="14" r="1.7" fill="${PALETTE.pupil}"/>
  </g>`;
}

/**
 * A stylised waveform, used only by the browser preview so the strip isn't
 * empty and the spacing is honest. The export draws the real thing from the
 * clip's audio via `showwaves`, so this shape is indicative, not exact.
 */
function previewWaveform(ratio: ReelRatio): string {
  // Fixed sample set — a preview that reshuffled every render would be noise.
  const amps = [
    0.18, 0.34, 0.62, 0.9, 0.72, 0.44, 0.22, 0.36, 0.68, 1, 0.86, 0.5, 0.28, 0.16,
    0.4, 0.74, 0.58, 0.3, 0.18, 0.46, 0.82, 0.64, 0.38, 0.2, 0.32, 0.56, 0.88, 0.7,
    0.42, 0.24, 0.14, 0.3, 0.52, 0.78, 0.6, 0.34, 0.2, 0.26, 0.44, 0.22,
  ];
  const midY = waveformY(ratio) + WAVEFORM.height / 2;
  const step = WAVEFORM.width / amps.length;
  const bars = amps
    .map((a, i) => {
      const h = Math.max(2, a * (WAVEFORM.height / 2));
      const x = WAVEFORM.x + i * step + step / 2;
      return `<line x1="${x.toFixed(1)}" y1="${(midY - h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(midY + h).toFixed(1)}"/>`;
    })
    .join("");
  return `<g stroke="${WAVEFORM.color}" stroke-width="2.5" stroke-linecap="round" opacity="0.9">${bars}</g>`;
}

type BuildOptions = {
  layer?: ReelLayer;
  /** Preview only: draw the indicative waveform. */
  showWaveform?: boolean;
  /**
   * Per-reel caption. The only user-supplied string in this module — it is
   * escaped through `esc` like any other text node, and `captionLines` caps its
   * length and drops it entirely for 9:16.
   */
  caption?: string;
};

export function buildBackgroundSvg(
  ratio: ReelRatio,
  fonts: FontChoice = SERVER_FONTS,
  // Renamed on destructure: `caption` below is the star-row metrics.
  { layer = "all", showWaveform = false, caption: captionText }: BuildOptions = {},
): string {
  const card = CARD[ratio];
  const logo = logoMetrics();
  const status = statusMetrics();
  const caption = captionMetrics();
  const footerLeft =
    (REEL_W - monoWidth(FOOTER.text, FOOTER.fontSize, FOOTER.tracking)) / 2;

  const display800 = fontAttrs(fonts, "display", 800);
  const mono500 = fontAttrs(fonts, "mono", 500);
  const mono400 = fontAttrs(fonts, "mono", 400);

  const cardPath = roundedRectPath(card.x, card.y, card.w, card.h, CARD_RADIUS);
  // The bezel sits in the 3px ring immediately outside the card rect, so the
  // video can never cover it.
  const bezelInset = CARD_BEZEL / 2;
  const bezelPath = roundedRectPath(
    card.x - bezelInset,
    card.y - bezelInset,
    card.w + CARD_BEZEL,
    card.h + CARD_BEZEL,
    CARD_RADIUS + bezelInset,
  );

  const stars = Array.from({ length: CAPTION.starCount }, (_, i) => {
    const cx =
      caption.left + CAPTION.starOuter + i * (CAPTION.starOuter * 2 + CAPTION.starGap);
    return `<path d="${starPath(cx, captionCenterY(ratio), CAPTION.starOuter, CAPTION.starInner)}" fill="${PALETTE.accent}"/>`;
  }).join("");

  const mid = REEL_W / 2;
  const headlineCommon = `${display800} font-size="${HEADLINE.fontSize}" letter-spacing="${HEADLINE.tracking * HEADLINE.fontSize}" text-anchor="middle"`;

  // 16:9 slides the whole type block down so it sits above the video; 0 for
  // 9:16, which keeps its fixed positions. See `stackOffset`.
  const dy = stackOffset(ratio);

  // Line two is drawn twice: a blurred copy in which only "me." is inked (the
  // lead word stays transparent so advance widths — and therefore the accent's
  // position — are identical), then the crisp copy on top.
  const line2 = (leadOpacity: number) =>
    `<text x="${mid}" y="${HEADLINE.line2Baseline + dy}" ${headlineCommon} xml:space="preserve"><tspan fill="${PALETTE.text}" fill-opacity="${leadOpacity}">${esc(HEADLINE.line2Lead)}</tspan><tspan fill="${PALETTE.accent}">${esc(HEADLINE.line2Accent)}</tspan></text>`;

  const dotCy = STATUS.baseline + dy - STATUS.fontSize * 0.32;

  // Centred by measurement rather than `text-anchor`, for the same reason the
  // footer is: SVG adds letter-spacing after the final glyph, so an anchored
  // run sits half a space off centre.
  const lines = captionLines(ratio, captionText);
  const captionBase = captionBaselines(lines.length);
  const captionSvg = lines
    .map((line, i) => {
      const left = (REEL_W - monoWidth(line, CAPTION_TEXT.fontSize, CAPTION_TEXT.tracking)) / 2;
      return `<text x="${left}" y="${captionBase[i]}" ${mono400} font-size="${CAPTION_TEXT.fontSize}" letter-spacing="${CAPTION_TEXT.tracking * CAPTION_TEXT.fontSize}" fill="${PALETTE.text}" fill-opacity="${CAPTION_TEXT.opacity}">${esc(line)}</text>`;
    })
    .join("\n  ");

  const defs = `<defs>
    <radialGradient id="reelBottomGlow" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1"
      gradientTransform="translate(${BOTTOM_GLOW.cx} ${BOTTOM_GLOW.cy}) scale(${BOTTOM_GLOW.rx} ${BOTTOM_GLOW.ry})">
      <stop offset="0" stop-color="#b40000" stop-opacity="0.55"/>
      <stop offset="0.35" stop-color="#640000" stop-opacity="0.25"/>
      <stop offset="0.7" stop-color="#050505" stop-opacity="0"/>
      <stop offset="1" stop-color="#050505" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="reelBezel" gradientUnits="userSpaceOnUse"
      x1="${card.x}" y1="${card.y}" x2="${card.x}" y2="${card.y + card.h}">
      <stop offset="0" stop-color="${PALETTE.accentLight}" stop-opacity="0.95"/>
      <stop offset="0.45" stop-color="${PALETTE.accent}" stop-opacity="0.7"/>
      <stop offset="1" stop-color="${PALETTE.accent}" stop-opacity="0.12"/>
    </linearGradient>
    <filter id="reelCardGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${CARD_GLOW_BLUR}"/>
    </filter>
    <filter id="reelTextGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${HEADLINE.glowBlur}"/>
    </filter>
  </defs>`;

  const backdropLayer = `
  <rect width="${REEL_W}" height="${REEL_H}" fill="${PALETTE.bg}"/>
  <rect width="${REEL_W}" height="${REEL_H}" fill="url(#reelBottomGlow)"/>`;

  const cardFrameLayer = `
  <path d="${cardPath}" fill="${PALETTE.accent}" fill-opacity="0.42" filter="url(#reelCardGlow)"/>
  <path d="${cardPath}" fill="${PALETTE.bg}"/>
  <path d="${bezelPath}" fill="none" stroke="url(#reelBezel)" stroke-width="${CARD_BEZEL}"/>`;

  const baseLayer = backdropLayer + cardFrameLayer;

  const textLayer = `
  ${eyeSvg(logo.eyeLeft, LOGO.top + dy, LOGO.eyeSize)}
  <text x="${logo.textLeft}" y="${logo.textBaseline + dy}" ${display800} font-size="${LOGO.fontSize}"
    letter-spacing="${LOGO.tracking * LOGO.fontSize}" fill="${PALETTE.text}">${esc(LOGO.text)}</text>

  <circle cx="${status.dotCx}" cy="${dotCy}" r="${STATUS.ringRadius}" fill="none"
    stroke="${PALETTE.accent}" stroke-opacity="0.28" stroke-width="1.5"/>
  <circle cx="${status.dotCx}" cy="${dotCy}" r="${STATUS.dotRadius}" fill="${PALETTE.accent}"/>
  <text x="${status.textLeft}" y="${STATUS.baseline + dy}" ${mono500} font-size="${STATUS.fontSize}"
    letter-spacing="${STATUS.tracking * STATUS.fontSize}" fill="${PALETTE.muted}">${esc(STATUS.text)}</text>

  <text x="${mid}" y="${HEADLINE.line1Baseline + dy}" ${headlineCommon} fill="${PALETTE.text}">${esc(HEADLINE.line1)}</text>
  <g filter="url(#reelTextGlow)" opacity="0.9">${line2(0)}</g>
  ${line2(1)}

  ${captionSvg}
  ${stars}
  ${showWaveform ? previewWaveform(ratio) : ""}

  <text x="${footerLeft}" y="${FOOTER.baseline}" ${mono400} font-size="${FOOTER.fontSize}"
    letter-spacing="${FOOTER.tracking * FOOTER.fontSize}" fill="${PALETTE.text}"
    fill-opacity="${FOOTER.opacity}">${esc(FOOTER.text)}</text>`;

  const body =
    layer === "backdrop"
      ? backdropLayer
      : layer === "cardframe"
        ? cardFrameLayer
        : layer === "base"
          ? baseLayer
          : layer === "text"
            ? textLayer
            : baseLayer + textLayer;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${REEL_W}" height="${REEL_H}" viewBox="0 0 ${REEL_W} ${REEL_H}">
  ${defs}
  ${body}
</svg>`;
}

/** Linear blend between two `#rrggbb` strings. */
function mix(from: string, to: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const ch = (a: number, b: number) =>
    Math.round(a + (b - a) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
}

/**
 * The rotating sweep, as a square disc on opaque black.
 *
 * SVG has no conic gradient, so the ramp is approximated with `CONIC.wedges`
 * pie slices; at 1.5 degrees apiece the steps are already below what survives
 * the 2x upscale, and the grain pass finishes the job. Slices overlap by one
 * step to keep antialiased seams from showing as spokes.
 *
 * Emitted on black rather than transparent because it is screen-blended: under
 * `screen`, black is the identity, so the square's corners outside the disc
 * contribute nothing and the rotate filter can fill with black for free.
 */
export function buildConicSvg(): string {
  const { canvas, wedges, peakOpacity, tailWeight, leadFalloff, tailFalloff } = CONIC;
  const c = canvas / 2;
  const r = canvas / 2;
  const step = (Math.PI * 2) / wedges;

  const slices: string[] = [];
  for (let i = 0; i < wedges; i += 1) {
    const a0 = i * step;
    // One step of overlap; the final wedge wraps past 2*PI, which is fine.
    const a1 = a0 + step * 2;
    const mid = a0 + step / 2;
    const cos = Math.cos(mid);
    const lead = Math.pow(Math.max(0, cos), leadFalloff);
    const tail = Math.pow(Math.max(0, -cos), tailFalloff);
    const intensity = lead + tailWeight * tail;
    if (intensity < 0.004) continue;

    const x0 = (c + r * Math.cos(a0)).toFixed(2);
    const y0 = (c + r * Math.sin(a0)).toFixed(2);
    const x1 = (c + r * Math.cos(a1)).toFixed(2);
    const y1 = (c + r * Math.sin(a1)).toFixed(2);
    const fill = mix(PALETTE.accent, PALETTE.accentLight, Math.min(1, intensity));
    slices.push(
      `<path d="M${c} ${c}L${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}Z" fill="${fill}" fill-opacity="${(intensity * peakOpacity).toFixed(4)}"/>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">
  <defs>
    <radialGradient id="conicFade" gradientUnits="userSpaceOnUse" cx="${c}" cy="${c}" r="${r}">
      <stop offset="${CONIC.fadeStart}" stop-color="#ffffff"/>
      <stop offset="${CONIC.fadeEnd}" stop-color="#000000"/>
    </radialGradient>
    <mask id="conicMask"><rect width="${canvas}" height="${canvas}" fill="url(#conicFade)"/></mask>
  </defs>
  <rect width="${canvas}" height="${canvas}" fill="#000000"/>
  <g mask="url(#conicMask)">${slices.join("")}</g>
</svg>`;
}

/** The 140x140 noise tile from `--grain-tile` in globals.css (preview only). */
export function buildGrainTileSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${GRAIN.tile}" height="${GRAIN.tile}">
    <filter id="reelGrain"><feTurbulence type="fractalNoise" baseFrequency="${GRAIN.baseFrequency}" numOctaves="${GRAIN.numOctaves}" stitchTiles="stitch"/></filter>
    <rect width="100%" height="100%" filter="url(#reelGrain)"/>
  </svg>`;
}

/** Greyscale rounded-rect matte at card size (white = keep, black = cut). */
export function buildCardMaskSvg(ratio: ReelRatio): string {
  const { w, h } = CARD[ratio];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="#000000"/>
    <path d="${roundedRectPath(0, 0, w, h, CARD_RADIUS)}" fill="#ffffff"/>
  </svg>`;
}
