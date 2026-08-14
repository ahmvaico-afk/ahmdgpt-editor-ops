/**
 * Cover art tokens.
 *
 * Same discipline as the hook tool: the preview canvas *is* the export canvas,
 * so there is one renderer and no second implementation to drift.
 */

export const COVER_W = 1080;
export const COVER_H = 1920;

/**
 * Two crops to design against:
 *
 * - `highlight` — Instagram takes a circle out of the middle. Safe radius 330.
 * - `reel`      — the grid shows the centre square. Safe half-width 470.
 *
 * The renderer keeps every mark inside whichever is active, and the UI draws the
 * guide so you can see what will survive.
 */
export type CoverFormat = "highlight" | "reel";

export const SAFE = {
  highlight: { kind: "circle" as const, radius: 330 },
  reel: { kind: "square" as const, half: 470 },
};

export type CoverThemeKey = "ember" | "gold" | "signal" | "iris" | "mono";

export interface CoverTheme {
  /** Shown on the swatch chip. */
  name: string;
  /** Deeper than the app's #0a0a0c — cover art wants a richer black. */
  bg: string;
  /** Key light behind the mark. */
  glowInner: string;
  glowOuter: string;
  /** Cool counter-light from below, for depth. Very low alpha. */
  rim: string;
  /** Mark stroke, top of the gradient to bottom. */
  markLight: string;
  mark: string;
  markDeep: string;
  /** Iris fill, centre to edge. */
  irisInner: string;
  irisOuter: string;
  text: string;
  textMuted: string;
}

/**
 * Curated rather than generated. Each one is a two-light setup — a warm key
 * behind the mark and a cool rim underneath — which is what stops the plate
 * reading as a flat vignette.
 */
export const COVER_THEMES: Record<CoverThemeKey, CoverTheme> = {
  ember: {
    name: "Ember",
    bg: "#08080a",
    glowInner: "#ff2a3c",
    glowOuter: "#5c0a14",
    rim: "#3a1668",
    markLight: "#ff7a86",
    mark: "#ff2a3c",
    markDeep: "#a3101d",
    irisInner: "#2a1430",
    irisOuter: "#0a0610",
    text: "#f6f1f2",
    textMuted: "#9c8a8d",
  },
  gold: {
    name: "Gold",
    bg: "#0a0805",
    glowInner: "#e8b95c",
    glowOuter: "#4a3208",
    rim: "#6b2a10",
    markLight: "#ffdb9a",
    mark: "#d4a853",
    markDeep: "#8a6420",
    irisInner: "#2e2412",
    irisOuter: "#0d0a05",
    text: "#f7f2e8",
    textMuted: "#a3947a",
  },
  signal: {
    name: "Signal",
    bg: "#05090a",
    glowInner: "#00ff85",
    glowOuter: "#053d2a",
    rim: "#0a3a5c",
    markLight: "#8affc4",
    mark: "#00ff85",
    markDeep: "#0a8a4c",
    irisInner: "#0d2b24",
    irisOuter: "#04100c",
    text: "#eefaf4",
    textMuted: "#7fa697",
  },
  iris: {
    name: "Iris",
    bg: "#07070d",
    glowInner: "#7c5cff",
    glowOuter: "#1e1450",
    rim: "#0a4a6b",
    markLight: "#c2b3ff",
    mark: "#7c5cff",
    markDeep: "#3d2aa8",
    irisInner: "#221a4a",
    irisOuter: "#08060f",
    text: "#f2f0fa",
    textMuted: "#8f8aad",
  },
  mono: {
    name: "Mono",
    bg: "#0a0a0a",
    glowInner: "#d8d8d8",
    glowOuter: "#2a2a2a",
    rim: "#1c1c26",
    markLight: "#ffffff",
    mark: "#e6e6e6",
    markDeep: "#7a7a7a",
    irisInner: "#242424",
    irisOuter: "#080808",
    text: "#f5f5f5",
    textMuted: "#8f8f8f",
  },
};

export type CoverMotif =
  | "eye"
  | "stars"
  | "play"
  | "trend"
  | "orbit"
  | "waves"
  | "rings"
  | "scan"
  | "wordmark";

export const COVER_MOTIFS: { value: CoverMotif; label: string }[] = [
  { value: "eye", label: "Eye" },
  { value: "stars", label: "Stars" },
  { value: "play", label: "Play" },
  { value: "trend", label: "Trend" },
  { value: "orbit", label: "Orbit" },
  { value: "waves", label: "Waves" },
  { value: "rings", label: "Rings" },
  { value: "scan", label: "Scan" },
  { value: "wordmark", label: "Wordmark" },
];

export interface CoverConfig {
  format: CoverFormat;
  theme: CoverThemeKey;
  motif: CoverMotif;
  label: string;
  /** 0..1.5 — how hot the key light burns. */
  glow: number;
  /** 0..1 — film grain. */
  grain: number;
  /** 0..1 — darkening at the edges. */
  vignette: number;
  /** Mark size as a fraction of the safe area. */
  scale: number;
  showRing: boolean;
}

export const COVER_DEFAULT: CoverConfig = {
  format: "highlight",
  theme: "ember",
  motif: "eye",
  label: "TESTIMONIALS",
  glow: 0.85,
  grain: 0.42,
  vignette: 0.55,
  scale: 0.86,
  showRing: true,
};

/** Starter set, so the page is useful before anyone touches a control. */
export const COVER_PRESETS: { name: string; config: Partial<CoverConfig> }[] = [
  { name: "Testimonials", config: { motif: "stars", label: "TESTIMONIALS", theme: "gold" } },
  { name: "Reels", config: { motif: "play", label: "REELS", theme: "ember" } },
  { name: "Results", config: { motif: "trend", label: "RESULTS", theme: "signal" } },
  { name: "Clients", config: { motif: "orbit", label: "CLIENTS", theme: "ember" } },
  { name: "Pricing", config: { motif: "eye", label: "PRICING", theme: "gold" } },
  { name: "Process", config: { motif: "rings", label: "PROCESS", theme: "iris" } },
  { name: "About", config: { motif: "scan", label: "ABOUT", theme: "ember" } },
  { name: "Contact", config: { motif: "waves", label: "CONTACT", theme: "ember" } },
  { name: "Brand", config: { motif: "wordmark", label: "", theme: "mono", showRing: false } },
];

export const COVER_LIMITS = {
  label: 18,
  glow: { min: 0, max: 1.5 },
  grain: { min: 0, max: 1 },
  vignette: { min: 0, max: 1 },
  scale: { min: 0.5, max: 1.15 },
} as const;

export function coverFileName(config: CoverConfig): string {
  const slug =
    (config.label || config.motif)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "cover";
  return `ahmdgpt-${config.format}-${slug}.png`;
}
