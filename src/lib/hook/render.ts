/**
 * Draws a hook overlay onto a 2D canvas.
 *
 * This is the only place hook layout exists. The on-screen preview and the
 * exported PNG are the same canvas at the same size — the preview is scaled
 * down with CSS, never re-laid-out — so what an editor approves is exactly what
 * lands in the file.
 *
 * Browser-only: it needs measureText and the page's loaded webfonts.
 */
import { emojiImage, segmentHookText } from "./emoji";
import { HOOK_H, HOOK_W, type HookConfig } from "./spec";

type Atom =
  | { kind: "word"; text: string; width: number }
  | { kind: "emoji"; codes: string; width: number };

/**
 * Casing is a display transform, never applied to the stored text — switching
 * back to "as typed" has to return the editor's original wording intact.
 */
function applyCase(value: string, textCase: HookConfig["textCase"]): string {
  if (textCase === "upper") return value.toUpperCase();
  if (textCase === "title") {
    // Only the first letter of each run of letters, so "DON'T" keeps its
    // apostrophe intact rather than becoming "Don'T".
    return value.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, lead, ch) => lead + ch.toUpperCase());
  }
  return value;
}

type Line = { atoms: Atom[]; width: number };

/** Canvas letterSpacing is recent; where it's missing we draw at natural tracking. */
function supportsLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return "letterSpacing" in ctx;
}

function applyFont(ctx: CanvasRenderingContext2D, config: HookConfig, family: string): void {
  ctx.font = `${config.fontWeight} ${config.fontSize}px ${family}`;
  if (supportsLetterSpacing(ctx)) {
    ctx.letterSpacing = `${(config.letterSpacing * config.fontSize).toFixed(3)}px`;
  }
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
}

/**
 * Splits into wrap units. A run of text becomes its words; every emoji is its
 * own unit so a line can break either side of it.
 */
function toAtoms(ctx: CanvasRenderingContext2D, text: string, config: HookConfig): Atom[] {
  const emojiSize = config.fontSize * config.emojiScale;
  const atoms: Atom[] = [];

  for (const seg of segmentHookText(text)) {
    if (seg.kind === "emoji") {
      atoms.push({ kind: "emoji", codes: seg.codes, width: emojiSize });
      continue;
    }
    const value = applyCase(seg.value, config.textCase);
    // Keep the split on whitespace but drop the whitespace itself; the space
    // advance is added back between atoms at layout time.
    const words = value.split(/(\s+)/);
    for (const word of words) {
      if (word === "" || /^\s+$/.test(word)) {
        // A run of whitespace ends the previous word — nothing to measure.
        continue;
      }
      atoms.push({ kind: "word", text: word, width: ctx.measureText(word).width });
    }
  }
  return atoms;
}

/**
 * Whether a space belongs between two neighbouring atoms. Emoji written tight
 * against a word ("statin..😳") must not gain one, so the original text is
 * consulted rather than assuming a space between every atom.
 */
function spacingMap(text: string, config: HookConfig): boolean[] {
  const flags: boolean[] = [];
  let pendingSpace = false;
  let first = true;

  for (const seg of segmentHookText(text)) {
    if (seg.kind === "emoji") {
      if (!first) flags.push(pendingSpace);
      first = false;
      pendingSpace = false;
      continue;
    }
    const value = applyCase(seg.value, config.textCase);
    const parts = value.split(/(\s+)/);
    for (const part of parts) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) {
        pendingSpace = true;
        continue;
      }
      if (!first) flags.push(pendingSpace);
      first = false;
      pendingSpace = false;
    }
  }
  return flags;
}

function layout(
  ctx: CanvasRenderingContext2D,
  text: string,
  config: HookConfig,
): { lines: Line[]; maxWidth: number } {
  const atoms = toAtoms(ctx, text, config);
  const gaps = spacingMap(text, config);
  const spaceWidth = ctx.measureText(" ").width;
  const limit = HOOK_W * config.maxWidthPct - config.pillPadX * 2;

  const lines: Line[] = [];
  let current: Line = { atoms: [], width: 0 };

  atoms.forEach((atom, i) => {
    // gaps[i - 1] describes the join between atom i-1 and atom i.
    const gap = i > 0 && gaps[i - 1] ? spaceWidth : 0;
    const next = current.atoms.length === 0 ? atom.width : current.width + gap + atom.width;

    if (current.atoms.length > 0 && next > limit) {
      lines.push(current);
      current = { atoms: [atom], width: atom.width };
      return;
    }
    current.width = next;
    current.atoms.push(atom);
  });

  if (current.atoms.length > 0) lines.push(current);
  if (lines.length === 0) lines.push({ atoms: [], width: 0 });

  return { lines, maxWidth: Math.max(...lines.map((l) => l.width), 0) };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface RenderOptions {
  /** Resolved CSS family for the chosen font — next/font hands us the real name. */
  fontFamily: string;
}

/**
 * Clears the canvas and draws the hook. Leaves everything outside the overlay
 * fully transparent, which is what makes the export droppable straight onto a
 * clip in any editor.
 */
export function renderHook(
  ctx: CanvasRenderingContext2D,
  text: string,
  config: HookConfig,
  { fontFamily }: RenderOptions,
): void {
  ctx.clearRect(0, 0, HOOK_W, HOOK_H);
  ctx.save();
  applyFont(ctx, config, fontFamily);

  const { lines, maxWidth } = layout(ctx, text, config);
  const lineHeight = config.fontSize * config.lineHeight;

  const hasPill = config.pillMode !== "none" && config.pillOpacity > 0;
  const padX = hasPill ? config.pillPadX : 0;
  const padY = hasPill ? config.pillPadY : 0;

  /**
   * Plates are built around the cap height, not the line box. Sizing them off
   * the line box left the padding lopsided — the first line got `padY` above it
   * while the last got `padY + leading` below, which reads as a plate that is
   * too tight at the top and too loose at the bottom.
   *
   * 0.73 is cap height as a fraction of em for the grotesques on offer; close
   * enough for all three that measuring per-face isn't worth the reflow.
   */
  const capHeight = config.fontSize * 0.73;
  const pillHeight = capHeight + padY * 2;

  const blockWidth = maxWidth + padX * 2;
  const blockHeight = (lines.length - 1) * lineHeight + pillHeight;

  const blockX =
    config.align === "left"
      ? (HOOK_W * (1 - config.maxWidthPct)) / 2
      : config.align === "right"
        ? HOOK_W - blockWidth - (HOOK_W * (1 - config.maxWidthPct)) / 2
        : (HOOK_W - blockWidth) / 2;

  const blockY =
    config.anchor === "top"
      ? HOOK_H * config.offsetPct
      : config.anchor === "bottom"
        ? HOOK_H - blockHeight - HOOK_H * config.offsetPct
        : (HOOK_H - blockHeight) / 2;

  // Shadow belongs to the plate when there is one, otherwise to the type.
  const applyShadow = () => {
    if (config.shadowBlur <= 0 && config.shadowOffsetY === 0) return;
    ctx.shadowColor = withAlpha(config.shadowColor, 0.45);
    ctx.shadowBlur = config.shadowBlur;
    ctx.shadowOffsetY = config.shadowOffsetY;
  };
  const clearShadow = () => {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };

  if (hasPill) {
    ctx.fillStyle = withAlpha(config.pillColor, config.pillOpacity);
    applyShadow();
    if (config.pillMode === "block") {
      roundRect(ctx, blockX, blockY, blockWidth, blockHeight, config.pillRadius);
      ctx.fill();
    } else {
      lines.forEach((line, i) => {
        const w = line.width + padX * 2;
        const x =
          config.align === "left"
            ? blockX
            : config.align === "right"
              ? blockX + blockWidth - w
              : blockX + (blockWidth - w) / 2;
        roundRect(ctx, x, blockY + i * lineHeight, w, pillHeight, config.pillRadius);
        ctx.fill();
      });
    }
    clearShadow();
  }

  // Sits the first line's caps exactly `padY` below the plate's top edge, which
  // is what makes the padding symmetric on every line.
  const firstBaseline = blockY + padY + capHeight;

  const gaps = spacingMap(text, config);
  const spaceWidth = ctx.measureText(" ").width;

  lines.forEach((line, i) => {
    const baseline = firstBaseline + i * lineHeight;
    const lineX =
      config.align === "left"
        ? blockX + padX
        : config.align === "right"
          ? blockX + blockWidth - padX - line.width
          : blockX + (blockWidth - line.width) / 2;

    let x = lineX;
    // Index of this line's first atom within the whole run, so the gap flags
    // line up after wrapping.
    const offset = lines.slice(0, i).reduce((n, l) => n + l.atoms.length, 0);

    line.atoms.forEach((atom, j) => {
      const globalIndex = offset + j;
      if (j > 0 && gaps[globalIndex - 1]) x += spaceWidth;

      if (atom.kind === "emoji") {
        const img = emojiImage(atom.codes);
        const size = config.fontSize * config.emojiScale;
        // Sits on the baseline the way a glyph does, with a touch of overshoot.
        if (img) ctx.drawImage(img, x, baseline - size * 0.82, size, size);
        x += atom.width;
        return;
      }

      if (!hasPill) applyShadow();
      if (config.strokeWidth > 0) {
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeStyle = config.strokeColor;
        ctx.lineWidth = config.strokeWidth * 2;
        ctx.strokeText(atom.text, x, baseline);
      }
      ctx.fillStyle = config.textColor;
      ctx.fillText(atom.text, x, baseline);
      if (!hasPill) clearShadow();
      x += atom.width;
    });
  });

  ctx.restore();
}
