/**
 * Splits hook text into plain runs and emoji, and loads the emoji artwork.
 *
 * Emoji are drawn as images rather than as glyphs on purpose: a font would
 * render as whatever set the editor's device happens to ship (Segoe on Windows,
 * Noto on Android, Apple on a Mac), so the same hook would look different for
 * every editor and different again in the export. Images make it identical
 * everywhere, and make the artwork swappable — see scripts/sync-emoji.ts.
 */

export type HookSegment =
  | { kind: "text"; value: string }
  | { kind: "emoji"; char: string; codes: string };

/**
 * Emoji_Presentation covers the ones that are always coloured; the
 * Extended_Pictographic + FE0F pair catches the text-default ones that were
 * explicitly asked to render as emoji (⚠️, ❗️). A bare Extended_Pictographic
 * with no FE0F — like the digits in keycaps — is left as text.
 */
const EMOJI_RE = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)/u;

function isEmojiGrapheme(grapheme: string): boolean {
  return EMOJI_RE.test(grapheme);
}

/** Lowercase dash-joined codepoints — the filename stem the artwork uses. */
export function toCodes(grapheme: string): string {
  return [...grapheme]
    .map((ch) => ch.codePointAt(0)!.toString(16))
    .join("-");
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/**
 * Grapheme-aware so a multi-codepoint emoji (family sequences, skin tones,
 * flags) stays one unit instead of being torn into its parts.
 */
export function segmentHookText(text: string): HookSegment[] {
  const graphemes: string[] = segmenter
    ? [...segmenter.segment(text)].map((s) => s.segment)
    : // Older engines: code points are a good enough approximation, and every
      // browser we target has Intl.Segmenter anyway.
      [...text];

  const out: HookSegment[] = [];
  for (const g of graphemes) {
    if (isEmojiGrapheme(g)) {
      out.push({ kind: "emoji", char: g, codes: toCodes(g) });
      continue;
    }
    const last = out[out.length - 1];
    if (last?.kind === "text") last.value += g;
    else out.push({ kind: "text", value: g });
  }
  return out;
}

/**
 * Filenames to try, most specific first. The artwork names some sequences with
 * the variation selector and some without, and a skin-toned emoji we have no
 * image for should still fall back to its base form rather than vanish.
 */
function candidates(codes: string): string[] {
  const parts = codes.split("-");
  const withoutVs = parts.filter((p) => p !== "fe0f");
  const list = [codes];
  if (withoutVs.length !== parts.length) list.push(withoutVs.join("-"));
  if (withoutVs.length > 1) list.push(withoutVs[0]);
  return [...new Set(list)];
}

const cache = new Map<string, Promise<HTMLImageElement | null>>();

function loadOne(stem: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "sync";
    // Same origin, but set explicitly so the canvas never taints and toBlob works.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `/emoji/${stem}.png`;
  });
}

/** Resolves to null when we have no artwork — the renderer then skips it. */
export function loadEmoji(codes: string): Promise<HTMLImageElement | null> {
  let hit = cache.get(codes);
  if (!hit) {
    hit = (async () => {
      for (const stem of candidates(codes)) {
        const img = await loadOne(stem);
        if (img) return img;
      }
      return null;
    })();
    cache.set(codes, hit);
  }
  return hit;
}

/** Decoded and ready to draw. Filled by preloadEmoji. */
const ready = new Map<string, HTMLImageElement | null>();

/**
 * Warms the cache for every emoji in the text. The renderer is synchronous — it
 * draws whatever is already decoded — so the caller awaits this first and then
 * draws, which is what keeps the preview from reflowing as images trickle in.
 */
export async function preloadEmoji(text: string): Promise<void> {
  const codes = new Set(
    segmentHookText(text)
      .filter((s): s is Extract<HookSegment, { kind: "emoji" }> => s.kind === "emoji")
      .map((s) => s.codes),
  );
  await Promise.all(
    [...codes].map(async (c) => {
      ready.set(c, await loadEmoji(c));
    }),
  );
}

/** Synchronous peek for the renderer; null until preloadEmoji has resolved. */
export function emojiImage(codes: string): HTMLImageElement | null {
  return ready.get(codes) ?? null;
}
