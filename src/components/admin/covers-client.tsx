"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { HOOK_FONT_FAMILIES } from "@/lib/hook/fonts";
import { renderCover } from "@/lib/cover/render";
import {
  COVER_DEFAULT,
  COVER_H,
  COVER_LIMITS,
  COVER_MOTIFS,
  COVER_PRESETS,
  COVER_THEMES,
  COVER_W,
  coverFileName,
  type CoverConfig,
  type CoverFormat,
  type CoverMotif,
  type CoverThemeKey,
} from "@/lib/cover/spec";

export function CoversClient() {
  const [config, setConfig] = useState<CoverConfig>(COVER_DEFAULT);
  const [showGuide, setShowGuide] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const display = HOOK_FONT_FAMILIES.display;
  const mono = HOOK_FONT_FAMILIES.mono;

  const set = useCallback(<K extends keyof CoverConfig>(key: K, value: CoverConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([
        document.fonts.load(`800 96px ${display}`).catch(() => undefined),
        document.fonts.load(`500 56px ${mono}`).catch(() => undefined),
      ]);
      if (cancelled) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      renderCover(ctx, config, { displayFamily: display, monoFamily: mono, showGuide });
    })();
    return () => {
      cancelled = true;
    };
  }, [config, showGuide, display, mono]);

  /** Re-renders without the guide so the crop marks never land in the file. */
  function exportBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return resolve(null);
      renderCover(ctx, config, { displayFamily: display, monoFamily: mono, showGuide: false });
      canvas.toBlob((blob) => {
        renderCover(ctx, config, { displayFamily: display, monoFamily: mono, showGuide });
        resolve(blob);
      }, "image/png");
    });
  }

  async function download() {
    setBusy(true);
    try {
      const blob = await exportBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = coverFileName(config);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast("Downloaded.");
    } finally {
      setBusy(false);
    }
  }

  /** Every preset, one file each — the whole highlight row in a single click. */
  async function downloadAll() {
    setBusy(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      setBusy(false);
      return;
    }
    try {
      for (const preset of COVER_PRESETS) {
        const merged: CoverConfig = { ...config, ...preset.config };
        renderCover(ctx, merged, { displayFamily: display, monoFamily: mono, showGuide: false });
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = coverFileName(merged);
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        // Browsers drop rapid-fire downloads; a beat between them keeps all nine.
        await new Promise((r) => setTimeout(r, 320));
      }
      setToast(`${COVER_PRESETS.length} covers downloaded.`);
    } finally {
      renderCover(ctx, config, { displayFamily: display, monoFamily: mono, showGuide });
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-extrabold text-text">Covers</h1>
        <p className="mt-1 text-sm text-muted">
          Highlight and reel covers on brand. The dashed guide shows what survives the crop —
          it&rsquo;s never in the downloaded file.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="sticky top-[56px] z-30 -mx-4 mb-5 border-b border-border bg-bg/95 px-4 pb-4 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-6 lg:mx-0 lg:rounded-xl lg:border lg:p-4 lg:backdrop-blur-none">
          <div className="flex items-center justify-center overflow-hidden rounded-xl border border-border">
            <canvas
              ref={canvasRef}
              width={COVER_W}
              height={COVER_H}
              aria-label="Cover preview"
              className="block h-auto w-auto max-h-[52vh] max-w-full lg:max-h-[68vh]"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={download} disabled={busy} className="flex-1 cursor-pointer">
              {busy ? "Working…" : "Download PNG"}
            </Button>
            <Button
              variant="outline"
              onClick={downloadAll}
              disabled={busy}
              className="cursor-pointer"
            >
              All 9
            </Button>
          </div>
          <label className="mt-2 flex cursor-pointer items-center justify-center gap-2">
            <input
              type="checkbox"
              checked={showGuide}
              onChange={(e) => setShowGuide(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-accent"
            />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Show crop guide
            </span>
          </label>
          {toast && (
            <p
              role="status"
              className="mt-2 text-center font-mono text-[11px] uppercase tracking-wider text-green"
            >
              {toast}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">Start from</h2>
            <div className="flex flex-wrap gap-1.5">
              {COVER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => setConfig((c) => ({ ...c, ...preset.config }))}
                  className="cursor-pointer rounded-full bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </section>

          <Card className="flex flex-col gap-4 p-4">
            <FieldRow label="Format">
              <Segmented
                options={[
                  { value: "highlight", label: "Highlight" },
                  { value: "reel", label: "Reel cover" },
                ]}
                value={config.format}
                onChange={(v) => set("format", v as CoverFormat)}
              />
            </FieldRow>

            <FieldRow label="Colour">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(COVER_THEMES) as CoverThemeKey[]).map((key) => {
                  const t = COVER_THEMES[key];
                  const on = config.theme === key;
                  return (
                    <button
                      key={key}
                      onClick={() => set("theme", key)}
                      aria-pressed={on}
                      className={`flex cursor-pointer items-center gap-2 rounded-full py-1 pl-1.5 pr-3 font-mono text-[11px] uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        on ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{
                          background: `radial-gradient(circle at 35% 30%, ${t.markLight}, ${t.mark} 55%, ${t.markDeep})`,
                        }}
                      />
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </FieldRow>

            <FieldRow label="Motif">
              <Segmented
                options={COVER_MOTIFS.map((m) => ({ value: m.value, label: m.label }))}
                value={config.motif}
                onChange={(v) => set("motif", v as CoverMotif)}
              />
            </FieldRow>

            <div className="flex flex-col gap-1.5">
              <Label>Label</Label>
              <Input
                value={config.label}
                maxLength={COVER_LIMITS.label}
                placeholder="TESTIMONIALS"
                onChange={(e) => set("label", e.target.value)}
                disabled={config.motif === "wordmark"}
              />
              {config.motif === "wordmark" && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                  Wordmark draws AHMD.GPT instead
                </p>
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-4">
            <Slider
              label="Glow"
              value={config.glow}
              min={COVER_LIMITS.glow.min}
              max={COVER_LIMITS.glow.max}
              step={0.01}
              onChange={(v) => set("glow", v)}
            />
            <Slider
              label="Grain"
              value={config.grain}
              min={COVER_LIMITS.grain.min}
              max={COVER_LIMITS.grain.max}
              step={0.01}
              onChange={(v) => set("grain", v)}
            />
            <Slider
              label="Vignette"
              value={config.vignette}
              min={COVER_LIMITS.vignette.min}
              max={COVER_LIMITS.vignette.max}
              step={0.01}
              onChange={(v) => set("vignette", v)}
            />
            <Slider
              label="Mark size"
              value={config.scale}
              min={COVER_LIMITS.scale.min}
              max={COVER_LIMITS.scale.max}
              step={0.01}
              onChange={(v) => set("scale", v)}
            />
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={config.showRing}
                onChange={(e) => set("showRing", e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-accent"
              />
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Hairline ring
              </span>
            </label>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className={`min-h-[36px] cursor-pointer rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              on ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-[11px] text-muted">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </div>
  );
}
