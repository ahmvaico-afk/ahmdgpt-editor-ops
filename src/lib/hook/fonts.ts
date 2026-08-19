/**
 * Faces the hook renderer can draw with.
 *
 * next/font serves the same file to every editor, so a hook laid out on a phone
 * in Karachi measures identically to one laid out on a laptop — which is the
 * whole reason the exported PNG can be trusted. Loading them here rather than
 * widening the global layout's Inter keeps the extra weights on the one page
 * that needs them.
 */
import { Inter, JetBrains_Mono, Montserrat, Syne } from "next/font/google";
import localFont from "next/font/local";
import type { HookFontKey } from "./spec";

const hookSans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "block",
});

const hookDisplay = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "block",
});

const hookMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "block",
});

/**
 * Stand-in for Proxima Nova, which is commercial and can't be committed. Same
 * geometric-sans family tree, and free to redistribute — so the picker always
 * has something in that shape even without an Adobe licence.
 */
const hookGeometric = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  display: "block",
});

/**
 * Proxima Nova, from the owner's own licensed copy committed under src/fonts.
 * Only the Semibold cut is on hand, so 600 is the single weight offered —
 * declaring weights we don't have a file for would just make the browser
 * synthesise a fake bold, which looks wrong and measures differently.
 *
 * Drop further cuts in the same folder and add them to `src` to widen it.
 */
const hookProxima = localFont({
  src: [{ path: "../../fonts/ProximaNova-Semibold.ttf", weight: "600", style: "normal" }],
  display: "block",
});

export const HOOK_FONT_FAMILIES: Record<HookFontKey, string> = {
  sans: hookSans.style.fontFamily,
  display: hookDisplay.style.fontFamily,
  mono: hookMono.style.fontFamily,
  geometric: hookGeometric.style.fontFamily,
  proxima: hookProxima.style.fontFamily,
};

/** Weights each face actually ships, so the UI can't offer one that isn't loaded. */
export const HOOK_FONT_WEIGHTS: Record<HookFontKey, number[]> = {
  sans: [400, 500, 600, 700, 800, 900],
  display: [600, 700, 800],
  mono: [400, 500, 700, 800],
  geometric: [500, 600, 700, 800, 900],
  proxima: [600],
};

/** Nearest available weight for a face, for when the editor switches fonts. */
export function nearestWeight(fontKey: HookFontKey, weight: number): number {
  const options = HOOK_FONT_WEIGHTS[fontKey];
  return options.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
  );
}
