/**
 * Page-wide film grain. The tile itself lives in `globals.css` as
 * `--grain-tile` so the reel compositor can reuse the same noise.
 */
export function GrainOverlay() {
  return <div aria-hidden className="grain-layer fixed inset-0 z-50" />;
}
