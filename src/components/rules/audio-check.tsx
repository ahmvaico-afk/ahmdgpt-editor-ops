"use client";

import { useRef, useState } from "react";
import { measureLoudness } from "@/lib/loudness";

export type AudioCheck =
  | { status: "idle" }
  | { status: "measuring"; fileName: string }
  | { status: "done"; fileName: string; lufs: number; peakDb: number; pass: boolean }
  /// The browser couldn't decode this file's audio — the editor ticks the
  /// volume rule by hand instead, and QA sees it wasn't measured.
  | { status: "unreadable"; fileName: string };

/** Lowest point on the meter. Anything quieter just pins to the left. */
const METER_FLOOR = -30;

export function audioCheckPassed(check: AudioCheck) {
  return (check.status === "done" && check.pass) || check.status === "unreadable";
}

/**
 * Drop the exported video, get told whether it's loud enough. The file is read
 * in the browser and never uploaded.
 */
export function AudioCheckBox({
  minLufs,
  value,
  onChange,
}: {
  minLufs: number;
  value: AudioCheck;
  onChange: (next: AudioCheck) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function check(file: File) {
    onChange({ status: "measuring", fileName: file.name });
    try {
      const { lufs, peakDb } = await measureLoudness(file);
      onChange({ status: "done", fileName: file.name, lufs, peakDb, pass: lufs >= minLufs });
    } catch {
      onChange({ status: "unreadable", fileName: file.name });
    }
  }

  const pct = (lufs: number) =>
    Math.min(100, Math.max(0, ((lufs - METER_FLOOR) / -METER_FLOOR) * 100));

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void check(file);
        }}
        className={`rounded-lg border border-dashed px-4 py-4 text-center text-xs transition-colors ${
          dragging ? "border-accent bg-accent/5 text-text" : "border-border bg-surface-2 text-muted hover:text-text"
        }`}
      >
        {value.status === "idle"
          ? "Drop your exported video here (or click) to check the volume"
          : value.status === "measuring"
            ? `Listening to ${value.fileName}…`
            : `${value.fileName} · click to check a different file`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void check(file);
          e.target.value = "";
        }}
      />

      {value.status === "done" && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            value.pass ? "border-green/40 bg-green/5" : "border-accent/50 bg-accent/5"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className={`font-mono text-sm font-medium ${value.pass ? "text-green" : "text-accent"}`}>
              {value.pass ? "✓ Loud enough" : "✕ Too quiet"}
            </span>
            <span className="font-mono text-xs text-muted">
              {Number.isFinite(value.lufs) ? value.lufs.toFixed(1) : "silent"} LUFS · peak{" "}
              {Number.isFinite(value.peakDb) ? value.peakDb.toFixed(1) : "—"} dB
            </span>
          </div>
          <div className="relative mt-2.5 h-2 rounded-full bg-surface-2">
            <div
              className={`h-2 rounded-full ${value.pass ? "bg-green" : "bg-accent"}`}
              style={{ width: `${pct(value.lufs)}%` }}
            />
            <div
              className="absolute -top-1 h-4 w-0.5 bg-text"
              style={{ left: `${pct(minLufs)}%` }}
              title={`Needs at least ${minLufs} LUFS`}
            />
          </div>
          {!value.pass && (
            <p className="mt-2 text-xs text-text">
              Needs about {Math.ceil(minLufs - value.lufs)} dB more. Max out the volume in CapCut,
              export again and drop the new file.
            </p>
          )}
        </div>
      )}

      {value.status === "unreadable" && (
        <p className="rounded-lg border border-warning/50 bg-warning/5 px-4 py-3 text-xs text-warning">
          Couldn&rsquo;t read the audio in this file. Double-check the volume is maxed out yourself,
          or export as MP4 and try again.
        </p>
      )}
    </div>
  );
}
