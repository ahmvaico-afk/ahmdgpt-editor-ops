/**
 * Copies the emoji artwork into `public/emoji/` and writes the index the picker
 * and the renderer read.
 *
 * Runs from `prebuild` (and `predev`) rather than being committed, because the
 * artwork is ~28 MB across ~3,800 files — it travels as a devDependency and is
 * regenerated on each build instead of bloating the repo. `public/emoji/` is
 * gitignored for the same reason.
 *
 * SWAPPING THE ARTWORK: point `SOURCE_DIR` at any folder of PNGs named by
 * codepoint (`1f633.png`, `0023-fe0f-20e3.png`). Nothing else in the app knows
 * where the images came from, so a licensed set drops straight in.
 */
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, "node_modules", "emoji-datasource-apple", "img", "apple", "64");
const DATA_FILE = path.join(ROOT, "node_modules", "emoji-datasource-apple", "emoji.json");
const OUT_DIR = path.join(ROOT, "public", "emoji");
const INDEX_FILE = path.join(ROOT, "src", "lib", "hook", "emoji-index.json");

/** Picked for the quick row in the picker — what actually shows up in our hooks. */
const QUICK_PICKS = [
  "1F633", // flushed
  "1F62D", // loudly crying
  "1F92F", // exploding head
  "1F631", // screaming
  "1F440", // eyes
  "1F480", // skull
  "1F62C", // grimacing
  "1F644", // rolling eyes
  "1F925", // lying face
  "1F914", // thinking
  "1F64F", // folded hands
  "1F449", // point right
  "26A0-FE0F", // warning
  "1F6A8", // rotating light
  "2757", // exclamation
  "1F525", // fire
  "2705", // check mark
  "274C", // cross mark
];

type RawEmoji = {
  unified: string;
  short_name: string;
  short_names: string[];
  category: string;
  sort_order: number;
  has_img_apple?: boolean;
};

/** What the browser bundle gets: small enough to ship, enough to search on. */
type IndexEntry = {
  /** Lowercase, dash-joined codepoints — also the PNG filename stem. */
  u: string;
  /** The literal emoji character, for insertion into the text. */
  c: string;
  /** Short name, used as the search key and the tooltip. */
  n: string;
  /** Category index into `categories`. */
  g: number;
};

function toChar(unified: string): string {
  return unified
    .split("-")
    .map((cp) => String.fromCodePoint(parseInt(cp, 16)))
    .join("");
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    throw new Error(
      `Emoji artwork not found at ${SOURCE_DIR}. Run \`npm install\` — it ships as a devDependency.`,
    );
  }

  const raw: RawEmoji[] = JSON.parse(await readFile(DATA_FILE, "utf8"));
  const files = new Set(await readdir(SOURCE_DIR));

  // Rebuilt from scratch so a swapped-in artwork set never leaves stale PNGs behind.
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  let copied = 0;
  await Promise.all(
    [...files]
      .filter((f) => f.endsWith(".png"))
      .map(async (file) => {
        await copyFile(path.join(SOURCE_DIR, file), path.join(OUT_DIR, file));
        copied += 1;
      }),
  );

  const categories: string[] = [];
  const entries: IndexEntry[] = [];

  for (const e of raw) {
    if (e.has_img_apple === false) continue;
    const stem = `${e.unified.toLowerCase()}.png`;
    if (!files.has(stem)) continue;
    // "Component" is skin-tone modifiers and the like — never picked on its own.
    if (e.category === "Component") continue;

    let g = categories.indexOf(e.category);
    if (g === -1) {
      categories.push(e.category);
      g = categories.length - 1;
    }
    entries.push({
      u: e.unified.toLowerCase(),
      c: toChar(e.unified),
      n: e.short_name.replace(/_/g, " "),
      g,
    });
  }

  const sortOrder = new Map(raw.map((r) => [r.unified.toLowerCase(), r.sort_order]));
  entries.sort((a, b) =>
    a.g !== b.g ? a.g - b.g : (sortOrder.get(a.u) ?? 0) - (sortOrder.get(b.u) ?? 0),
  );

  const quick = QUICK_PICKS.map((u) => u.toLowerCase()).filter((u) =>
    entries.some((e) => e.u === u),
  );

  await writeFile(
    INDEX_FILE,
    `${JSON.stringify({ categories, quick, entries }, null, 0)}\n`,
    "utf8",
  );

  console.log(
    `sync-emoji: ${copied} images -> public/emoji, ${entries.length} indexed across ${categories.length} categories`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
