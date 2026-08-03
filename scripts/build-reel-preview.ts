/**
 * Emits a standalone `reel-preview.html` — the reel composition in a single file
 * that opens in any browser with no dev server.
 *
 * The plate comes from `buildBackgroundSvg`, the same function the export
 * rasterises, and the brand TTFs are inlined as base64 `@font-face` rules, so
 * the preview cannot drift from the MP4 the way a hand-written mock would.
 * Run: npx tsx scripts/build-reel-preview.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CARD,
  CARD_RADIUS,
  CONIC,
  PALETTE,
  REEL_H,
  REEL_W,
  type ReelRatio,
} from "../src/lib/reel/spec";
import { SERVER_FONTS, buildBackgroundSvg, buildConicSvg } from "../src/lib/reel/svg";

const FONT_DIR = path.join(process.cwd(), "assets", "reel-fonts");
const RATIOS: ReelRatio[] = ["9x16", "16x9"];

/** Stand-in for the per-reel caption; 16:9 only, ignored by 9:16. */
const SAMPLE_CAPTION = "Sarah K. · Northwind Studios";

/** weight/style pairs matching the faces resvg loads server-side. */
/**
 * Each file is registered twice: once under the family browsers use, and once
 * under the family name baked into the TTF, because the SVG is built with
 * SERVER_FONTS and asks for the latter. See SERVER_FAMILY.
 */
const FACES = [
  { file: "Syne-ExtraBold.ttf", family: "Syne", weight: 800, alias: "Syne ExtraBold" },
  { file: "Syne-Bold.ttf", family: "Syne", weight: 700 },
  {
    file: "JetBrainsMono-Medium.ttf",
    family: "JetBrains Mono",
    weight: 500,
    alias: "JetBrains Mono Medium",
  },
  { file: "JetBrainsMono-Regular.ttf", family: "JetBrains Mono", weight: 400 },
];

async function fontFaceCss(): Promise<string> {
  const rules = await Promise.all(
    FACES.map(async ({ file, family, weight, alias }) => {
      const b64 = (await readFile(path.join(FONT_DIR, file))).toString("base64");
      const src = `url(data:font/ttf;base64,${b64}) format("truetype")`;
      const rule = (name: string, w: number) =>
        `@font-face{font-family:"${name}";font-weight:${w};font-style:normal;font-display:block;src:${src}}`;
      // The alias family holds a single face, so one rule spanning every weight
      // covers it — emitting a per-weight rule too would just duplicate the
      // base64 payload.
      return alias
        ? `${rule(family, weight)}\n@font-face{font-family:"${alias}";font-weight:400 900;font-style:normal;font-display:block;src:${src}}`
        : rule(family, weight);
    }),
  );
  return rules.join("\n");
}

async function main() {
  const fonts = await fontFaceCss();

  // SERVER_FONTS, not BROWSER_FONTS: the latter points at next/font CSS
  // variables that do not exist outside the app, which would silently fall back
  // to a system face and misreport the layout.
  // Layered exactly as the export composites: backdrop, rotating sweep, card
  // frame, video, text.
  const conic = buildConicSvg();
  const discSize = CONIC.radius * 2;
  const plates = RATIOS.map(
    (ratio) =>
      `<div class="plate" data-ratio="${ratio}" ${ratio === "9x16" ? "" : "hidden"}>` +
      buildBackgroundSvg(ratio, SERVER_FONTS, { layer: "backdrop" }) +
      `<div class="sweep" style="left:${CONIC.cx - CONIC.radius}px;top:${CONIC.cy - CONIC.radius}px;` +
      `width:${discSize}px;height:${discSize}px">${conic}</div>` +
      buildBackgroundSvg(ratio, SERVER_FONTS, { layer: "cardframe" }) +
      `<div class="card" style="left:${CARD[ratio].x}px;top:${CARD[ratio].y}px;width:${CARD[ratio].w}px;height:${CARD[ratio].h}px">` +
      `<video hidden playsinline autoplay loop muted></video>` +
      `<span class="card-empty">Your video here</span>` +
      `</div>` +
      buildBackgroundSvg(ratio, SERVER_FONTS, {
        layer: "text",
        showWaveform: true,
        // Baked, not editable: the wrap is measured server-side, so live typing
        // here would need a second implementation of it.
        caption: SAMPLE_CAPTION,
      }) +
      `</div>`,
  ).join("\n");

  const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AHMD.GPT reel — preview</title>
<style>
${fonts}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#08080a;color:#e7e7ea;
  font-family:"JetBrains Mono",ui-monospace,monospace;font-size:13px;
  display:flex;flex-direction:column;align-items:center;gap:18px;padding:24px}
header{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center}
button,label.file{background:#141418;border:1px solid #2a2a31;color:#e7e7ea;
  padding:7px 13px;border-radius:7px;cursor:pointer;font:inherit;letter-spacing:.04em}
button[aria-pressed="true"]{background:${PALETTE.accent};border-color:${PALETTE.accent};color:#fff}
button:hover,label.file:hover{border-color:#45454f}
input[type=file]{display:none}
.stage{width:min(94vw,420px)}
.frame{position:relative;width:100%;overflow:hidden;border-radius:12px;
  outline:1px solid #26262c;outline-offset:-1px;background:${PALETTE.bg}}
.scaler{position:absolute;inset:0 auto auto 0;transform-origin:top left;
  width:${REEL_W}px;height:${REEL_H}px}
.plate{position:absolute;inset:0}
/* Direct children only — the sweep's own svg must fill .sweep, not the plate. */
.plate>svg{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
/* screen mirrors the FFmpeg blend, so the sweep only ever adds light. */
.sweep{position:absolute;pointer-events:none;mix-blend-mode:screen;
  animation:sweep-spin ${CONIC.periodSeconds}s linear infinite}
.sweep svg{display:block;width:100%;height:100%}
@keyframes sweep-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sweep{animation:none}}
.card{position:absolute;overflow:hidden;border-radius:${CARD_RADIUS}px;
  display:flex;align-items:center;justify-content:center;background:#141418}
.card video{width:100%;height:100%;object-fit:cover}
.card-empty{font-size:26px;letter-spacing:.28em;text-transform:uppercase;color:#6b6b76}
footer{color:#6b6b76;text-align:center;line-height:1.7;max-width:44ch}
code{color:#9a9aa6}
</style>

<header>
  <button data-set="9x16" aria-pressed="true">9&#8239;:&#8239;16 card</button>
  <button data-set="16x9" aria-pressed="false">16&#8239;:&#8239;9 card</button>
  <label class="file">Load a clip<input type="file" accept="video/*"></label>
  <button id="sweep" aria-pressed="true">Sweep</button>
</header>

<div class="stage">
  <div class="frame" style="aspect-ratio:${REEL_W}/${REEL_H}">
    <div class="scaler">
${plates}
    </div>
  </div>
</div>

<footer>
  Plate rendered from <code>buildBackgroundSvg()</code> at ${REEL_W}&times;${REEL_H}.
  The waveform is indicative &mdash; the export draws the real one from your clip's audio.
  The 16:9 caption is a sample &mdash; you type the real one in the app.
</footer>

<script>
const frame = document.querySelector(".frame");
const scaler = document.querySelector(".scaler");
new ResizeObserver(([e]) => {
  scaler.style.transform = "scale(" + e.contentRect.width / ${REEL_W} + ")";
}).observe(frame);

for (const btn of document.querySelectorAll("[data-set]")) {
  btn.addEventListener("click", () => {
    const want = btn.dataset.set;
    for (const b of document.querySelectorAll("[data-set]")) {
      b.setAttribute("aria-pressed", String(b.dataset.set === want));
    }
    for (const p of document.querySelectorAll(".plate")) {
      p.hidden = p.dataset.ratio !== want;
    }
  });
}

document.getElementById("sweep").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", String(on));
  for (const s of document.querySelectorAll(".sweep")) {
    s.style.display = on ? "" : "none";
  }
});

document.querySelector("input[type=file]").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  for (const v of document.querySelectorAll(".card video")) {
    v.src = url;
    v.hidden = false;
  }
  for (const s of document.querySelectorAll(".card-empty")) s.remove();
});
</script>
`;

  const out = path.join(process.cwd(), "reel-preview.html");
  await writeFile(out, html, "utf8");
  console.log(`wrote ${out} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
