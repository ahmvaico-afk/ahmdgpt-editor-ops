"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { EmojiPicker, EmojiQuickRow } from "@/components/portal/emoji-picker";
import { HOOK_FONT_FAMILIES, HOOK_FONT_WEIGHTS, nearestWeight } from "@/lib/hook/fonts";
import { preloadEmoji } from "@/lib/hook/emoji";
import { renderHook } from "@/lib/hook/render";
import {
  HOOK_FONT_LABELS,
  HOOK_H,
  HOOK_LIMITS,
  HOOK_W,
  HOUSE_STYLE,
  SAMPLE_HOOK_TEXT,
  hookFileName,
  type HookAlign,
  type HookAnchor,
  type HookConfig,
  type HookFontKey,
  type HookPillMode,
  type HookTextCase,
} from "@/lib/hook/spec";

interface Preset {
  id: string;
  name: string;
  isDefault: boolean;
  editable: boolean;
  config: HookConfig;
}

/**
 * Proxima Nova is only offered when an Adobe Fonts kit is configured — it's a
 * commercial face served under the owner's licence. Without the kit the option
 * is hidden rather than silently substituting a different typeface, which would
 * quietly change every export's line breaks.
 */
const PROXIMA_AVAILABLE = Boolean(process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT_ID);

const AVAILABLE_FONTS = (Object.keys(HOOK_FONT_LABELS) as HookFontKey[]).filter(
  (k) => k !== "proxima" || PROXIMA_AVAILABLE,
);

type Panel = "text" | "plate" | "position";

export function HookToolClient() {
  const [text, setText] = useState(SAMPLE_HOOK_TEXT);
  /**
   * Null means "whatever the selected preset says". Only an actual edit puts a
   * config here, which is what lets the tool open on the house style without an
   * effect racing the preset fetch to seed it.
   */
  const [edited, setEdited] = useState<HookConfig | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const { data, mutate } = useSWR<{ presets: Preset[] }>("/api/hook-presets", fetcher);
  const presets = useMemo(() => data?.presets ?? [], [data]);

  // Falls back to the house style, so the tool is usable the moment it opens.
  const active =
    presets.find((p) => p.id === activeId) ??
    presets.find((p) => p.isDefault) ??
    presets[0] ??
    null;
  const config = edited ?? active?.config ?? HOUSE_STYLE;
  const dirty = active ? JSON.stringify(active.config) !== JSON.stringify(config) : false;
  const family = HOOK_FONT_FAMILIES[config.fontKey];

  function selectPreset(preset: Preset) {
    setActiveId(preset.id);
    setEdited(null);
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /**
   * The preview canvas is the export canvas — full 1080x1920, scaled down by
   * CSS. Emoji artwork and the webfont are both awaited first, because the
   * renderer draws synchronously and would otherwise miss them on first paint.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const body = text.trim() ? text : SAMPLE_HOOK_TEXT;
      await Promise.all([
        preloadEmoji(body),
        document.fonts
          .load(`${config.fontWeight} ${config.fontSize}px ${family}`)
          .catch(() => undefined),
      ]);
      if (cancelled) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      renderHook(ctx, body, config, { fontFamily: family });
    })();
    return () => {
      cancelled = true;
    };
  }, [text, config, family]);

  const set = useCallback(
    <K extends keyof HookConfig>(key: K, value: HookConfig[K]) => {
      setEdited({ ...config, [key]: value });
    },
    [config],
  );

  function insertEmoji(char: string) {
    const el = textRef.current;
    if (!el) {
      setText((t) => t + char);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? start;
    const next = text.slice(0, start) + char + text.slice(end);
    setText(next);
    // Put the caret after the inserted emoji rather than jumping to the end.
    requestAnimationFrame(() => {
      el.focus();
      const at = start + char.length;
      el.setSelectionRange(at, at);
    });
  }

  function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(resolve, "image/png");
    });
  }

  async function download() {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = hookFileName(text || "hook");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setToast("PNG downloaded — drop it straight onto the clip.");
  }

  async function copyImage() {
    try {
      const blob = await toBlob();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setToast("Copied — paste it into your editor.");
    } catch {
      setToast("This browser won't allow copying images. Use Download instead.");
    }
  }

  async function savePreset(name: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/hook-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(json.error ?? "Could not save.");
        return;
      }
      await mutate();
      // Drop the local edit so the new preset reads as saved, not dirty.
      setActiveId(json.preset.id);
      setEdited(null);
      setSavingName(null);
      setToast(`Saved “${name}”.`);
    } finally {
      setBusy(false);
    }
  }

  async function updatePreset() {
    if (!active?.editable) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hook-presets/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(json.error ?? "Could not update.");
        return;
      }
      await mutate();
      setToast(`Updated “${active.name}”.`);
    } finally {
      setBusy(false);
    }
  }

  async function deletePreset() {
    if (!active?.editable) return;
    if (!confirm(`Delete the preset “${active.name}”?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/hook-presets/${active.id}`, { method: "DELETE" });
      if (!res.ok) {
        setToast("Could not delete.");
        return;
      }
      // Falls back to the house style rather than leaving the deleted preset's
      // styling hanging around as an unsaved edit.
      setActiveId(null);
      setEdited(null);
      await mutate();
      setToast("Preset deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-extrabold text-text">Hook Text</h1>
        <p className="mt-1 text-sm text-muted">
          Type the hook, pick a look, download a transparent PNG. Drop it on top of your clip.
        </p>
      </div>

      {/*
        Two columns on a wide screen, stacked on a phone — but in both cases the
        preview is sticky, so changing a setting never scrolls it out of view.
        Sticks below the portal header, which is itself sticky at ~57px.
      */}
      <div className="lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="sticky top-[56px] z-30 -mx-4 mb-5 border-b border-border bg-bg/95 px-4 pb-4 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-6 lg:mx-0 lg:rounded-xl lg:border lg:p-4 lg:backdrop-blur-none">
          {/* The checkerboard is what tells you the export really is transparent. */}
          <div
            // items-center matters: a flex parent defaults to align stretch,
            // which overrides the canvas's auto height and squashes the 9:16.
            className="flex items-center justify-center overflow-hidden rounded-lg border border-border"
            style={{
              backgroundColor: "#1a1a1a",
              backgroundImage: "repeating-conic-gradient(#242424 0% 25%, #1a1a1a 0% 50%)",
              backgroundSize: "22px 22px",
            }}
          >
            <canvas
              ref={canvasRef}
              width={HOOK_W}
              height={HOOK_H}
              // Capped in vh rather than against the parent: a percentage
              // max-height resolves to none when the parent's height is auto,
              // which let the 9:16 frame overflow instead of scaling to fit.
              className="block h-auto w-auto max-h-[64vh] max-w-full lg:max-h-[72vh]"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={download} className="flex-1">
              Download PNG
            </Button>
            <Button variant="outline" onClick={copyImage}>
              Copy
            </Button>
          </div>
          {toast && (
            <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-wider text-green">
              {toast}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-3 p-4">
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, HOOK_LIMITS.textLength))}
          rows={2}
          placeholder="What they DON'T tell you about…"
          className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-base text-text outline-none placeholder:text-muted-2 focus:border-accent"
        />
        <div className="flex items-center gap-2">
          <EmojiQuickRow onPick={insertEmoji} />
          <button
            onClick={() => setShowPicker((v) => !v)}
            className={`ml-auto shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              showPicker ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
            }`}
          >
            {showPicker ? "Close" : "All emoji"}
          </button>
        </div>
        {showPicker && <EmojiPicker onPick={insertEmoji} />}
      </Card>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">Presets</h2>
          {dirty && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-warning">
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPreset(p)}
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                active?.id === p.id
                  ? "bg-accent text-bg"
                  : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              {p.name}
              {p.isDefault ? " ★" : ""}
            </button>
          ))}
        </div>

        {savingName === null ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setSavingName("")}>
              Save as preset
            </Button>
            {active?.editable && dirty && (
              <Button size="sm" variant="outline" disabled={busy} onClick={updatePreset}>
                Update &ldquo;{active.name}&rdquo;
              </Button>
            )}
            {active?.editable && (
              <Button size="sm" variant="danger" disabled={busy} onClick={deletePreset}>
                Delete
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEdited(HOUSE_STYLE)}>
              Reset to house style
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              autoFocus
              value={savingName}
              maxLength={HOOK_LIMITS.presetName}
              placeholder="Preset name"
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && savingName.trim()) void savePreset(savingName.trim());
                if (e.key === "Escape") setSavingName(null);
              }}
              className="!w-44"
            />
            <Button
              size="sm"
              disabled={busy || !savingName.trim()}
              onClick={() => void savePreset(savingName.trim())}
            >
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSavingName(null)}>
              Cancel
            </Button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(["text", "plate", "position"] as Panel[]).map((p) => (
            <button
              key={p}
              onClick={() => setPanel(panel === p ? null : p)}
              className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                panel === p ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {panel === "text" && (
          <Card className="flex flex-col gap-4 p-4">
            <Field label="Font">
              <Select
                value={config.fontKey}
                onChange={(e) => {
                  const key = e.target.value as HookFontKey;
                  // Snap the weight too — Syne has no 400, Inter has no 300.
                  setEdited({
                    ...config,
                    fontKey: key,
                    fontWeight: nearestWeight(key, config.fontWeight),
                  });
                }}
              >
                {AVAILABLE_FONTS.map((k) => (
                  <option key={k} value={k}>
                    {HOOK_FONT_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Weight">
              <Segmented
                options={HOOK_FONT_WEIGHTS[config.fontKey].map((w) => ({
                  value: String(w),
                  label: String(w),
                }))}
                value={String(config.fontWeight)}
                onChange={(v) => set("fontWeight", Number(v))}
              />
            </Field>
            <Slider
              label="Size"
              value={config.fontSize}
              min={HOOK_LIMITS.fontSize.min}
              max={HOOK_LIMITS.fontSize.max}
              step={1}
              onChange={(v) => set("fontSize", v)}
            />
            <Slider
              label="Letter spacing"
              value={config.letterSpacing}
              min={HOOK_LIMITS.letterSpacing.min}
              max={HOOK_LIMITS.letterSpacing.max}
              step={0.005}
              format={(v) => `${(v * 100).toFixed(1)}%`}
              onChange={(v) => set("letterSpacing", v)}
            />
            <Slider
              label="Line height"
              value={config.lineHeight}
              min={HOOK_LIMITS.lineHeight.min}
              max={HOOK_LIMITS.lineHeight.max}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => set("lineHeight", v)}
            />
            <Slider
              label="Emoji size"
              value={config.emojiScale}
              min={HOOK_LIMITS.emojiScale.min}
              max={HOOK_LIMITS.emojiScale.max}
              step={0.05}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => set("emojiScale", v)}
            />
            <Field label="Caps">
              <Segmented
                options={[
                  { value: "none", label: "As typed" },
                  { value: "upper", label: "ALL CAPS" },
                  { value: "title", label: "Title Case" },
                ]}
                value={config.textCase}
                onChange={(v) => set("textCase", v as HookTextCase)}
              />
            </Field>
            <Swatch label="Text" value={config.textColor} onChange={(v) => set("textColor", v)} />
            <Slider
              label="Outline"
              value={config.strokeWidth}
              min={HOOK_LIMITS.strokeWidth.min}
              max={HOOK_LIMITS.strokeWidth.max}
              step={0.5}
              onChange={(v) => set("strokeWidth", v)}
            />
            {config.strokeWidth > 0 && (
              <Swatch
                label="Outline colour"
                value={config.strokeColor}
                onChange={(v) => set("strokeColor", v)}
              />
            )}
          </Card>
        )}

        {panel === "plate" && (
          <Card className="flex flex-col gap-4 p-4">
            <Field label="Background">
              <Segmented
                options={[
                  { value: "block", label: "One box" },
                  { value: "line", label: "Per line" },
                  { value: "none", label: "None" },
                ]}
                value={config.pillMode}
                onChange={(v) => set("pillMode", v as HookPillMode)}
              />
            </Field>
            {config.pillMode !== "none" && (
              <>
                <Swatch
                  label="Colour"
                  value={config.pillColor}
                  onChange={(v) => set("pillColor", v)}
                />
                <Slider
                  label="Opacity"
                  value={config.pillOpacity}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => set("pillOpacity", v)}
                />
                <Slider
                  label="Corner radius"
                  value={config.pillRadius}
                  min={HOOK_LIMITS.pillRadius.min}
                  max={HOOK_LIMITS.pillRadius.max}
                  step={1}
                  onChange={(v) => set("pillRadius", v)}
                />
                <Slider
                  label="Padding across"
                  value={config.pillPadX}
                  min={HOOK_LIMITS.pillPadX.min}
                  max={HOOK_LIMITS.pillPadX.max}
                  step={1}
                  onChange={(v) => set("pillPadX", v)}
                />
                <Slider
                  label="Padding down"
                  value={config.pillPadY}
                  min={HOOK_LIMITS.pillPadY.min}
                  max={HOOK_LIMITS.pillPadY.max}
                  step={1}
                  onChange={(v) => set("pillPadY", v)}
                />
              </>
            )}
            <Slider
              label="Drop shadow"
              value={config.shadowBlur}
              min={HOOK_LIMITS.shadowBlur.min}
              max={HOOK_LIMITS.shadowBlur.max}
              step={1}
              onChange={(v) => set("shadowBlur", v)}
            />
          </Card>
        )}

        {panel === "position" && (
          <Card className="flex flex-col gap-4 p-4">
            <Field label="Align">
              <Segmented
                options={[
                  { value: "left", label: "Left" },
                  { value: "center", label: "Centre" },
                  { value: "right", label: "Right" },
                ]}
                value={config.align}
                onChange={(v) => set("align", v as HookAlign)}
              />
            </Field>
            <Field label="Anchor">
              <Segmented
                options={[
                  { value: "top", label: "Top" },
                  { value: "middle", label: "Middle" },
                  { value: "bottom", label: "Bottom" },
                ]}
                value={config.anchor}
                onChange={(v) => set("anchor", v as HookAnchor)}
              />
            </Field>
            {config.anchor !== "middle" && (
              <Slider
                label={config.anchor === "top" ? "Distance from top" : "Distance from bottom"}
                value={config.offsetPct}
                min={HOOK_LIMITS.offsetPct.min}
                max={HOOK_LIMITS.offsetPct.max}
                step={0.005}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => set("offsetPct", v)}
              />
            )}
            <Slider
              label="Max width"
              value={config.maxWidthPct}
              min={HOOK_LIMITS.maxWidthPct.min}
              max={HOOK_LIMITS.maxWidthPct.max}
              step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => set("maxWidthPct", v)}
            />
          </Card>
        )}
      </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
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
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-[11px] text-muted">
          {format ? format(value) : Math.round(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-accent"
      />
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
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
            value === o.value ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label>{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-12 cursor-pointer rounded border border-border bg-surface-2"
      />
      <span className="font-mono text-[11px] uppercase text-muted">{value}</span>
    </div>
  );
}

