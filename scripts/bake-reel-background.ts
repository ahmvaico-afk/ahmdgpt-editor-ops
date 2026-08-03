/**
 * Renders the reel background plates to disk so the template can be eyeballed
 * without running a full video export.
 *
 *   npm run reel:bake -- ./out
 *
 * The app itself renders these on demand and caches them in memory; this script
 * exists purely for inspecting the design.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderCardMaskPng, renderPlatePng } from "../src/lib/reel/background";
import { REEL_RATIOS } from "../src/lib/reel/spec";

async function main() {
  const outDir = path.resolve(process.argv[2] ?? "reel-preview");
  mkdirSync(outDir, { recursive: true });

  for (const ratio of REEL_RATIOS) {
    const started = Date.now();

    for (const layer of ["all", "base", "text"] as const) {
      const png = await renderPlatePng(ratio, layer);
      writeFileSync(path.join(outDir, `plate-${ratio}-${layer}.png`), png);
    }

    const mask = await renderCardMaskPng(ratio);
    writeFileSync(path.join(outDir, `card-mask-${ratio}.png`), mask);

    console.log(`${ratio.padEnd(5)} plates + mask written (${Date.now() - started}ms)`);
  }

  console.log(`\nWrote to ${outDir}`);
  console.log(
    "Note: grain and the audio waveform are applied by FFmpeg at render time,\n" +
      "so they aren't in these stills.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
