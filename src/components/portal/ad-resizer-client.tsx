"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import {
  AD_FORMATS,
  AD_FORMAT_KEYS,
  DEFAULT_LOOK,
  LOOK_LIMITS,
  drawAd,
  makeScratch,
  type AdFormat,
  type AdLook,
} from "@/lib/ad-resize/render";
import {
  canConvertVideo,
  convertImage,
  convertVideo,
  friendlyError,
  isImageFile,
  isVideoFile,
} from "@/lib/ad-resize/convert";

interface Item {
  key: string;
  file: File;
  kind: "video" | "image";
}

interface Job {
  key: string;
  itemKey: string;
  fmt: AdFormat;
  sourceName: string;
  status: "waiting" | "working" | "done" | "error";
  progress: number;
  error?: string;
  url?: string;
  outName?: string;
}

const SETTINGS_KEY = "adResizer";
const PREVIEW_H = 260;

function loadSettings(): { formats: AdFormat[]; look: AdLook } {
  const fallback = { formats: ["16x9", "4x5"] as AdFormat[], look: DEFAULT_LOOK };
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (!s) return fallback;
    const formats = (s.formats as AdFormat[]).filter((f) => f in AD_FORMATS);
    const clamp = (v: unknown, [lo, hi]: readonly [number, number], d: number) =>
      typeof v === "number" && v >= lo && v <= hi ? v : d;
    return {
      formats: formats.length ? formats : fallback.formats,
      look: {
        blur: clamp(s.look?.blur, LOOK_LIMITS.blur, DEFAULT_LOOK.blur),
        dim: clamp(s.look?.dim, LOOK_LIMITS.dim, DEFAULT_LOOK.dim),
      },
    };
  } catch {
    return fallback;
  }
}

export function AdResizerClient() {
  // Rendered client-only (see ad-resizer-loader), so localStorage is safe here.
  const [saved] = useState(loadSettings);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [formats, setFormats] = useState<AdFormat[]>(saved.formats);
  const [look, setLook] = useState<AdLook>(saved.look);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [videoOk, setVideoOk] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    canConvertVideo().then(setVideoOk);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ formats, look }));
    } catch {}
  }, [formats, look]);

  // Leaving mid-conversion would silently throw the work away.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  // Finished files live as blob URLs; free them when the page goes away.
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);
  useEffect(() => () => jobsRef.current.forEach((j) => j.url && URL.revokeObjectURL(j.url)), []);

  const addFiles = useCallback((list: FileList | File[]) => {
    const added: Item[] = [];
    const skipped: string[] = [];
    for (const file of Array.from(list)) {
      const kind = isVideoFile(file) ? "video" : isImageFile(file) ? "image" : null;
      if (!kind) {
        skipped.push(file.name);
        continue;
      }
      added.push({ key: crypto.randomUUID(), file, kind });
    }
    setNotice(
      skipped.length
        ? `Skipped ${skipped.join(", ")}: only videos (MP4, MOV) and images (PNG, JPG) work here.`
        : null
    );
    if (!added.length) return;
    setItems((prev) => [...prev, ...added]);
    setSelectedKey((k) => k ?? added[0].key);
  }, []);

  function removeItem(key: string) {
    const next = items.filter((i) => i.key !== key);
    setItems(next);
    if (selectedKey === key) setSelectedKey(next[0]?.key ?? null);
  }

  function toggleFormat(f: AdFormat) {
    setFormats((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : AD_FORMAT_KEYS.filter((k) => k === f || prev.includes(k))
    );
  }

  const blockedVideos = videoOk === false ? items.filter((i) => i.kind === "video") : [];
  const convertible = items.filter((i) => i.kind === "image" || videoOk);

  async function convertAll() {
    if (running || !convertible.length || !formats.length) return;
    const lookNow = { ...look };
    const batch: Job[] = convertible.flatMap((it) =>
      formats.map((fmt) => ({
        key: crypto.randomUUID(),
        itemKey: it.key,
        fmt,
        sourceName: it.file.name,
        status: "waiting" as const,
        progress: 0,
      }))
    );
    setJobs((prev) => [...batch, ...prev]);
    setRunning(true);
    const update = (key: string, patch: Partial<Job>) =>
      setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j)));

    // One at a time: two video encodes at once can exhaust a laptop's memory.
    for (const job of batch) {
      const it = convertible.find((i) => i.key === job.itemKey)!;
      update(job.key, { status: "working" });
      try {
        const res =
          it.kind === "image"
            ? await convertImage(it.file, job.fmt, lookNow)
            : await convertVideo(it.file, job.fmt, lookNow, (p) => update(job.key, { progress: p }));
        update(job.key, { status: "done", progress: 1, url: URL.createObjectURL(res.blob), outName: res.name });
      } catch (e) {
        console.warn("Ad Resizer:", job.sourceName, job.fmt, e);
        update(job.key, { status: "error", error: friendlyError(e) });
      }
    }
    setRunning(false);
  }

  async function downloadAll() {
    for (const j of jobs.filter((j) => j.status === "done")) {
      const a = document.createElement("a");
      a.href = j.url!;
      a.download = j.outName!;
      a.click();
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  function clearResults() {
    jobs.forEach((j) => j.url && URL.revokeObjectURL(j.url));
    setJobs([]);
  }

  const selected = items.find((i) => i.key === selectedKey) ?? null;
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const n = convertible.length;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-extrabold text-text">Ad Resizer</h1>
        <p className="mt-1 text-sm text-muted">
          Turn a 9:16 ad into 16:9 and 4:5. The whole ad stays in the middle, nothing is cropped or
          stretched, and the sides get a blurred copy of the ad.
        </p>
      </div>

      {videoOk === false && (
        <div className="mb-5 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-warning">
          This browser can&apos;t convert videos. Open the portal in <b>Google Chrome</b> or{" "}
          <b>Microsoft Edge</b> on a computer. Images still work here.
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* 1. Files */}
        <Card className="p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">1. Add your ads</p>
          <div
            role="button"
            tabIndex={0}
            onClick={() => pickRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pickRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragging ? "border-accent bg-accent/10" : "border-border hover:border-accent/60"
            }`}
          >
            <p className="font-semibold text-text">Drop videos or images here</p>
            <p className="mt-1 text-xs text-muted">or click to choose · MP4, MOV, PNG, JPG · many at once is fine</p>
            <input
              ref={pickRef}
              type="file"
              multiple
              accept="video/*,image/*,.mov,.mp4"
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {notice && <p className="mt-2 text-xs text-warning">{notice}</p>}

          {items.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {items.map((it) => (
                <li
                  key={it.key}
                  onClick={() => setSelectedKey(it.key)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    it.key === selectedKey ? "border-accent bg-accent/5" : "border-border bg-surface-2"
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase text-muted">{it.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-text" title={it.file.name}>
                    {it.file.name}
                  </span>
                  {blockedVideos.includes(it) && <span className="text-xs text-warning">needs Chrome</span>}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(it.key);
                    }}
                    disabled={running}
                    className="px-1 text-lg leading-none text-muted hover:text-accent disabled:opacity-30"
                    title="Remove"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* 2. Sizes + look + live preview */}
        <Card className="p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">2. Pick sizes and the look</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {AD_FORMAT_KEYS.map((f) => {
              const on = formats.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggleFormat(f)}
                  disabled={running}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    on ? "border-accent bg-accent/15 text-text" : "border-border bg-surface-2 text-muted hover:text-text"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {AD_FORMATS[f].label}{" "}
                  <span className="font-normal text-muted">
                    {AD_FORMATS[f].w}×{AD_FORMATS[f].h}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
            <Slider
              label="Blur"
              value={look.blur}
              range={LOOK_LIMITS.blur}
              step={1}
              shown={String(look.blur)}
              onChange={(blur) => setLook((l) => ({ ...l, blur }))}
            />
            <Slider
              label="Darken sides"
              value={look.dim}
              range={LOOK_LIMITS.dim}
              step={5}
              shown={`${look.dim}%`}
              onChange={(dim) => setLook((l) => ({ ...l, dim }))}
            />
            <Button variant="ghost" size="sm" onClick={() => setLook(DEFAULT_LOOK)}>
              Reset look
            </Button>
          </div>
          {selected ? (
            // Keyed so a new file starts with a clean preview instead of the last one's frame.
            <Preview key={selected.key} item={selected} formats={formats} look={look} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">Add an ad above to see a live preview.</p>
          )}
        </Card>

        <Button
          size="lg"
          onClick={convertAll}
          disabled={running || !n || !formats.length}
          className="w-full"
        >
          {running
            ? "Converting… keep this tab open"
            : !items.length
              ? "Add an ad to start"
              : !formats.length
                ? "Pick at least one size"
                : !n
                  ? "Open in Chrome to convert videos"
                  : `Convert ${n} ad${n > 1 ? "s" : ""} → ${formats.length} size${formats.length > 1 ? "s" : ""}`}
        </Button>

        {/* 3. Results */}
        {jobs.length > 0 && (
          <Card className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted">3. Your files</p>
              <div className="flex gap-2">
                {doneCount > 1 && (
                  <Button size="sm" variant="outline" onClick={downloadAll} disabled={running}>
                    Download all ({doneCount})
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={clearResults} disabled={running}>
                  Clear
                </Button>
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {jobs.map((j) => (
                <li
                  key={j.key}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-text" title={j.outName ?? j.sourceName}>
                      {j.status === "done" && <span className="text-green">✓ </span>}
                      {j.outName ?? j.sourceName}{" "}
                      <span className="text-muted">· {AD_FORMATS[j.fmt].label}</span>
                    </p>
                    {j.status === "working" && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded bg-border">
                        <div className="h-full bg-accent transition-all" style={{ width: `${j.progress * 100}%` }} />
                      </div>
                    )}
                    {j.status === "error" && <p className="mt-1 text-xs text-warning">{j.error}</p>}
                  </div>
                  <div className="text-right">
                    {j.status === "done" && (
                      <a href={j.url} download={j.outName} className={buttonClasses({ size: "sm" })}>
                        Download
                      </a>
                    )}
                    {j.status === "working" && (
                      <span className="font-mono text-xs text-muted">{Math.round(j.progress * 100)}%</span>
                    )}
                    {j.status === "waiting" && <span className="font-mono text-xs text-muted">waiting</span>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  range,
  step,
  shown,
  onChange,
}: {
  label: string;
  value: number;
  range: readonly [number, number];
  step: number;
  shown: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[96px_1fr_40px] items-center gap-3 text-sm text-text">
      {label}
      <input
        type="range"
        min={range[0]}
        max={range[1]}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent)]"
      />
      <span className="text-right font-mono text-xs text-muted">{shown}</span>
    </label>
  );
}

/** Live preview with the exact drawing code the export uses. */
function Preview({ item, formats, look }: { item: Item; formats: AdFormat[]; look: AdLook }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [media, setMedia] = useState<HTMLVideoElement | HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(item.file);
    let el: HTMLVideoElement | HTMLImageElement;
    if (item.kind === "image") {
      const img = new Image();
      img.onload = () => setMedia(img);
      img.onerror = () => setFailed(true);
      img.src = url;
      el = img;
    } else {
      const v = document.createElement("video");
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.onloadeddata = () => {
        setMedia(v);
        v.play().catch(() => {});
      };
      v.onerror = () => setFailed(true);
      v.src = url;
      el = v;
    }
    return () => {
      if (el instanceof HTMLVideoElement) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
      URL.revokeObjectURL(url);
    };
  }, [item]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !media) return;
    const sw = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const sh = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
    if (!sw || !sh) return;
    const scratch = makeScratch();
    const canvases = Array.from(box.querySelectorAll("canvas"));
    const src = { width: sw, height: sh, draw: (c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number) => c.drawImage(media, x, y, w, h) };
    const paint = () => {
      for (const c of canvases) drawAd(c.getContext("2d")!, c.width, c.height, src, look, scratch);
    };
    paint();
    if (!(media instanceof HTMLVideoElement)) return;
    let raf = 0;
    const loop = () => {
      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [media, formats, look]);

  if (failed) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        Can&apos;t preview this file in the browser. Converting may still work. If it fails, export it again as an H.264 MP4.
      </p>
    );
  }
  if (!formats.length) {
    return <p className="py-10 text-center text-sm text-muted">Pick at least one size.</p>;
  }
  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);
  return (
    <div ref={boxRef} className="flex flex-wrap items-end gap-4">
      {formats.map((f) => {
        const { w, h, label } = AD_FORMATS[f];
        const cw = Math.round((PREVIEW_H * w) / h);
        return (
          <div key={f} className="flex max-w-full flex-col gap-1">
            <canvas
              width={Math.round(cw * dpr)}
              height={Math.round(PREVIEW_H * dpr)}
              style={{ width: cw, aspectRatio: `${w} / ${h}` }}
              className="block h-auto max-w-full rounded-md bg-black"
            />
            <span className="font-mono text-[11px] text-muted">
              {label} · {w}×{h}
            </span>
          </div>
        );
      })}
    </div>
  );
}
