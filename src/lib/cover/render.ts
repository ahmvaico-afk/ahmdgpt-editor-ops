/**
 * Draws a cover onto a 2D canvas. Browser-only — it needs the page's webfonts.
 *
 * The plate is built as a lit scene rather than a flat vignette: a warm key
 * light behind the mark, a cool rim from below, then vignette and grain on top.
 * That two-light setup is what keeps a near-black frame from reading as a dead
 * rectangle at Instagram's thumbnail size.
 */
import {
  COVER_H,
  COVER_THEMES,
  COVER_W,
  SAFE,
  type CoverConfig,
  type CoverTheme,
} from "./spec";

const CX = COVER_W / 2;
const CY = COVER_H / 2;

/** Where the mark sits — lifted off centre to leave room for the label. */
const MARK_Y = CY - 66;

export interface CoverRenderOptions {
  displayFamily: string;
  monoFamily: string;
  /** Draws the crop guide. Preview only — never in the export. */
  showGuide?: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Radius of the region the mark must stay inside for this format. */
function safeRadius(config: CoverConfig): number {
  return config.format === "highlight" ? SAFE.highlight.radius : SAFE.reel.half;
}

/* ------------------------------------------------------------ background -- */

function paintBackground(ctx: CanvasRenderingContext2D, t: CoverTheme, config: CoverConfig): void {
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  // Key light: broad, warm, sitting behind and slightly below the mark so the
  // mark reads as lit from behind rather than floating on a gradient.
  const key = ctx.createRadialGradient(CX, MARK_Y + 140, 0, CX, MARK_Y + 140, 760);
  key.addColorStop(0, rgba(t.glowInner, 0.42 * config.glow));
  key.addColorStop(0.32, rgba(t.glowOuter, 0.34 * config.glow));
  key.addColorStop(0.72, rgba(t.glowOuter, 0.08 * config.glow));
  key.addColorStop(1, rgba(t.bg, 0));
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  // Hot core, tight and bright — this is what survives being shrunk to 60px.
  const core = ctx.createRadialGradient(CX, MARK_Y + 60, 0, CX, MARK_Y + 60, 300);
  core.addColorStop(0, rgba(t.glowInner, 0.3 * config.glow));
  core.addColorStop(1, rgba(t.glowInner, 0));
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  // Cool counter-light, bottom-left. Barely visible on its own; without it the
  // shadow side of the plate goes muddy.
  const rim = ctx.createRadialGradient(CX - 340, CY + 520, 0, CX - 340, CY + 520, 700);
  rim.addColorStop(0, rgba(t.rim, 0.3 * config.glow));
  rim.addColorStop(1, rgba(t.rim, 0));
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
}

function paintVignette(ctx: CanvasRenderingContext2D, t: CoverTheme, amount: number): void {
  if (amount <= 0) return;
  const v = ctx.createRadialGradient(CX, CY, 260, CX, CY, 1180);
  v.addColorStop(0, rgba(t.bg, 0));
  v.addColorStop(0.55, rgba(t.bg, 0.25 * amount));
  v.addColorStop(1, rgba("#000000", 0.92 * amount));
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
}

let grainTile: HTMLCanvasElement | null = null;

/**
 * Monochrome noise on an offscreen tile, stamped across the frame. Generated
 * once — regenerating per render made the grain crawl while you dragged a
 * slider, which looked like a bug.
 */
function grainPattern(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const size = 256;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const tctx = tile.getContext("2d")!;
  const img = tctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 145;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = tile;
  return tile;
}

function paintGrain(ctx: CanvasRenderingContext2D, amount: number): void {
  if (amount <= 0) return;
  const pattern = ctx.createPattern(grainPattern(), "repeat");
  if (!pattern) return;
  ctx.save();
  // Overlay scales each deviation by what is underneath, so the black holds and
  // the lit areas carry the texture — the way film grain actually falls.
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.5 * amount;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  ctx.restore();
}

/* ------------------------------------------------------------------ eye -- */

/** The EyeLogo path, traced at an arbitrary size. 28x28 source viewBox. */
function eyePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const s = size / 28;
  ctx.beginPath();
  ctx.moveTo(cx + (3 - 14) * s, cy);
  ctx.quadraticCurveTo(cx, cy + (5 - 14) * s, cx + (25 - 14) * s, cy);
  ctx.quadraticCurveTo(cx, cy + (23 - 14) * s, cx + (3 - 14) * s, cy);
  ctx.closePath();
}

/**
 * The mark. Stroked with a vertical gradient rather than a flat colour, bloomed
 * behind, and finished with a specular glint — the three things that were
 * missing when it read as clip art.
 */
function drawEye(
  ctx: CanvasRenderingContext2D,
  t: CoverTheme,
  cx: number,
  cy: number,
  size: number,
  { iris = true, glow = 1 }: { iris?: boolean; glow?: number } = {},
): void {
  const stroke = size * 0.05;

  // Bloom: a fat, blurred pass of the same path underneath.
  if (glow > 0) {
    ctx.save();
    ctx.filter = `blur(${Math.round(size * 0.07)}px)`;
    ctx.globalAlpha = 0.55 * glow;
    ctx.strokeStyle = t.mark;
    ctx.lineWidth = stroke * 1.9;
    ctx.lineJoin = "round";
    eyePath(ctx, cx, cy, size);
    ctx.stroke();
    ctx.restore();
  }

  const grad = ctx.createLinearGradient(cx, cy - size * 0.34, cx, cy + size * 0.34);
  grad.addColorStop(0, t.markLight);
  grad.addColorStop(0.5, t.mark);
  grad.addColorStop(1, t.markDeep);

  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = stroke;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  eyePath(ctx, cx, cy, size);
  ctx.stroke();
  ctx.restore();

  if (!iris) return;

  const irisR = (size * 4.2) / 28;
  const irisGrad = ctx.createRadialGradient(
    cx - irisR * 0.3,
    cy - irisR * 0.3,
    irisR * 0.1,
    cx,
    cy,
    irisR,
  );
  irisGrad.addColorStop(0, t.irisInner);
  irisGrad.addColorStop(1, t.irisOuter);

  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fillStyle = irisGrad;
  ctx.fill();
  ctx.lineWidth = stroke * 0.85;
  ctx.strokeStyle = grad;
  ctx.stroke();

  // Pupil.
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = "#050505";
  ctx.fill();

  // Specular glint — small, off-axis, low alpha. Reads as glass.
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.ellipse(
    cx - irisR * 0.34,
    cy - irisR * 0.4,
    irisR * 0.26,
    irisR * 0.17,
    -0.5,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outer: number,
  fill: string,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : outer * 0.44;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/* --------------------------------------------------------------- motifs -- */

function drawMotif(ctx: CanvasRenderingContext2D, t: CoverTheme, config: CoverConfig): void {
  const safe = safeRadius(config);
  const unit = safe * config.scale;
  const eyeSize = unit * 1.18;

  switch (config.motif) {
    case "stars": {
      drawEye(ctx, t, CX, MARK_Y - 46, eyeSize * 0.82, { glow: config.glow });
      const gap = unit * 0.24;
      for (let i = -2; i <= 2; i += 1) {
        drawStar(ctx, CX + i * gap, MARK_Y + unit * 0.46, unit * 0.1, t.markLight);
      }
      break;
    }
    case "play": {
      drawEye(ctx, t, CX, MARK_Y, eyeSize, { iris: false, glow: config.glow });
      const r = (eyeSize * 4.2) / 28;
      ctx.beginPath();
      ctx.arc(CX, MARK_Y, r, 0, Math.PI * 2);
      ctx.fillStyle = t.irisOuter;
      ctx.fill();
      ctx.lineWidth = eyeSize * 0.042;
      ctx.strokeStyle = t.mark;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CX - r * 0.34, MARK_Y - r * 0.46);
      ctx.lineTo(CX + r * 0.54, MARK_Y);
      ctx.lineTo(CX - r * 0.34, MARK_Y + r * 0.46);
      ctx.closePath();
      ctx.fillStyle = t.markLight;
      ctx.fill();
      break;
    }
    case "trend": {
      drawEye(ctx, t, CX, MARK_Y, eyeSize, { glow: config.glow });
      const w = unit * 0.72;
      ctx.save();
      ctx.strokeStyle = t.markLight;
      ctx.lineWidth = unit * 0.045;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(CX - w, MARK_Y + unit * 0.44);
      ctx.lineTo(CX - w * 0.34, MARK_Y + unit * 0.11);
      ctx.lineTo(CX + w * 0.06, MARK_Y + unit * 0.29);
      ctx.lineTo(CX + w * 0.92, MARK_Y - unit * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CX + w * 0.6, MARK_Y - unit * 0.2);
      ctx.lineTo(CX + w * 0.94, MARK_Y - unit * 0.2);
      ctx.lineTo(CX + w * 0.94, MARK_Y + unit * 0.14);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case "orbit": {
      drawEye(ctx, t, CX, MARK_Y, eyeSize * 0.78, { glow: config.glow });
      const r = unit * 0.86;
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const big = i % 3 === 0;
        ctx.beginPath();
        ctx.arc(CX + Math.cos(a) * r, MARK_Y + Math.sin(a) * r, big ? unit * 0.042 : unit * 0.022, 0, Math.PI * 2);
        ctx.fillStyle = big ? t.mark : t.textMuted;
        ctx.globalAlpha = big ? 1 : 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      break;
    }
    case "waves": {
      drawEye(ctx, t, CX, MARK_Y, eyeSize * 0.78, { glow: config.glow });
      ctx.save();
      ctx.lineWidth = unit * 0.028;
      ctx.lineCap = "round";
      for (let n = 1; n <= 3; n += 1) {
        const r = unit * (0.5 + n * 0.15);
        ctx.globalAlpha = 0.8 - n * 0.17;
        ctx.strokeStyle = t.mark;
        ctx.beginPath();
        ctx.arc(CX, MARK_Y, r, Math.PI * 1.16, Math.PI * 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(CX, MARK_Y, r, Math.PI * 1.5, Math.PI * 1.84);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "rings": {
      ctx.save();
      ctx.strokeStyle = t.mark;
      ctx.lineWidth = unit * 0.02;
      ctx.setLineDash([unit * 0.13, unit * 0.1]);
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(CX, MARK_Y, unit * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawEye(ctx, t, CX, MARK_Y, eyeSize * 0.78, { glow: config.glow });
      break;
    }
    case "scan": {
      drawEye(ctx, t, CX, MARK_Y, eyeSize, { glow: config.glow });
      ctx.save();
      for (let i = -2; i <= 2; i += 1) {
        const odd = Math.abs(i) % 2;
        ctx.globalAlpha = 0.14 + odd * 0.14;
        ctx.fillStyle = t.markLight;
        const w = unit * (0.9 - odd * 0.14);
        ctx.fillRect(CX - w, MARK_Y + i * unit * 0.2, w * 2, unit * 0.017);
      }
      ctx.restore();
      break;
    }
    case "wordmark":
      drawEye(ctx, t, CX, MARK_Y - unit * 0.16, eyeSize * 0.66, { glow: config.glow });
      break;
    case "eye":
    default:
      drawEye(ctx, t, CX, MARK_Y, eyeSize, { glow: config.glow });
      break;
  }
}

/* ---------------------------------------------------------------- label -- */

/** Shrinks until it fits the safe area at the label's height. */
function fitLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  maxWidth: number,
  start: number,
): number {
  let size = start;
  while (size > 24) {
    ctx.font = `500 ${size}px ${family}`;
    ctx.letterSpacing = `${(size * 0.2).toFixed(2)}px`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

/* ----------------------------------------------------------------- draw -- */

export function renderCover(
  ctx: CanvasRenderingContext2D,
  config: CoverConfig,
  { displayFamily, monoFamily, showGuide = false }: CoverRenderOptions,
): void {
  const t = COVER_THEMES[config.theme];
  const safe = safeRadius(config);

  ctx.clearRect(0, 0, COVER_W, COVER_H);
  paintBackground(ctx, t, config);

  if (config.showRing) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = rgba(t.mark, 0.28);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX, CY, safe, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawMotif(ctx, t, config);

  const labelY = MARK_Y + safe * 0.72;

  if (config.motif === "wordmark") {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    let size = 96;
    while (size > 32) {
      ctx.font = `800 ${size}px ${displayFamily}`;
      if (ctx.measureText("AHMD.GPT").width <= safe * 1.5) break;
      size -= 2;
    }
    ctx.fillStyle = t.text;
    ctx.fillText("AHMD.GPT", CX, labelY);
    ctx.restore();
  } else if (config.label.trim()) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const text = config.label.toUpperCase();
    // Chord of the safe area at this height, so long words never spill.
    const dy = Math.abs(labelY - CY);
    const maxWidth =
      config.format === "highlight"
        ? 2 * Math.sqrt(Math.max(0, safe * safe - dy * dy)) * 0.9
        : safe * 1.7;
    const size = fitLabel(ctx, text, monoFamily, maxWidth, 56);
    ctx.font = `500 ${size}px ${monoFamily}`;
    ctx.letterSpacing = `${(size * 0.2).toFixed(2)}px`;
    ctx.fillStyle = t.text;
    // Letter-spacing is added after the final glyph, so an anchored run sits
    // half a space off centre — measure and place it by hand instead.
    ctx.fillText(text, CX - ctx.measureText(text).width / 2, labelY);
    ctx.restore();
  }

  paintVignette(ctx, t, config.vignette);
  paintGrain(ctx, config.grain);

  // Preview affordance only. Never present in the exported bitmap.
  if (showGuide) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    if (config.format === "highlight") ctx.arc(CX, CY, safe, 0, Math.PI * 2);
    else ctx.rect(CX - safe, CY - safe, safe * 2, safe * 2);
    ctx.stroke();
    ctx.restore();
  }
}
