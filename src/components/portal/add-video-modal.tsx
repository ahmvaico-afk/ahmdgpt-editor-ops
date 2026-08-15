"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { calculatePriceCents, formatCents } from "@/lib/pricing";
import { minutesSecondsToDecimal } from "@/lib/duration";
import type { Style } from "@/lib/types";

export function AddVideoModal({
  open,
  onClose,
  styles,
  onCreated,
  currentBatch,
}: {
  open: boolean;
  onClose: () => void;
  styles: Style[];
  onCreated: () => void;
  currentBatch?: number;
}) {
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const styleId = selectedStyleId || styles[0]?.id || "";
  const [title, setTitle] = useState("");
  const [clientOrProject, setClientOrProject] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [durationSec, setDurationSec] = useState("");
  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState("");

  // Timed spans the editor has already logged but not yet attached to a video.
  const { data: timing, mutate: mutateTiming } = useSWR<{
    unlinked: { id: string; label: string; minutes: number }[];
  }>(open ? "/api/work-sessions" : null, fetcher);
  const unlinked = timing?.unlinked ?? [];

  const selectedStyle = styles.find((s) => s.id === styleId) ?? null;

  let effectiveRateCents: number | null = null;
  let effectiveIncrementCents = 0;
  if (selectedStyle?.isCustomPricing) {
    const r = parseFloat(rate);
    effectiveRateCents = Number.isFinite(r) ? Math.round(r * 100) : null;
  } else {
    effectiveRateCents = selectedStyle?.ratePerMinuteCents ?? null;
    effectiveIncrementCents = selectedStyle?.perMinuteIncrementCents ?? 0;
  }

  const minPart = parseInt(durationMin || "0", 10);
  const secPart = parseInt(durationSec || "0", 10);
  const parsedDuration =
    durationMin === "" && durationSec === ""
      ? NaN
      : minutesSecondsToDecimal(minPart, secPart);
  const livePriceCents =
    Number.isFinite(parsedDuration) && parsedDuration > 0 && effectiveRateCents !== null
      ? calculatePriceCents(parsedDuration, effectiveRateCents, effectiveIncrementCents)
      : null;

  function reset() {
    setTitle("");
    setClientOrProject("");
    setVideoLink("");
    setDurationMin("");
    setDurationSec("");
    setRate("");
    setNotes("");
    setSessionId("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedStyle) {
      setError("Choose a style.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: selectedStyle.id,
          title,
          clientOrProject,
          videoLink,
          notes,
          durationMinutes: parsedDuration,
          // Attaches the time already logged against this video, if the editor
          // ran the clock while working on it.
          ...(sessionId ? { workSessionId: sessionId } : {}),
          ...(selectedStyle.isCustomPricing
            ? { customRatePerMinuteDollars: parseFloat(rate) }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not submit.");
        return;
      }
      await mutateTiming();
      reset();
      onCreated();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Video">
      {currentBatch !== undefined && (
        <p className="-mt-2 mb-4 font-mono text-[11px] uppercase tracking-wider text-muted">
          Goes into Batch {currentBatch}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label>Style</Label>
          <Select value={styleId} onChange={(e) => setSelectedStyleId(e.target.value)} required>
            {styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Video title"
            required
          />
        </div>

        <div>
          <Label>Client / Project (optional)</Label>
          <Input
            value={clientOrProject}
            onChange={(e) => setClientOrProject(e.target.value)}
            placeholder="e.g. Acme Skincare"
          />
        </div>

        <div>
          <Label>Video link</Label>
          <Input
            type="url"
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            placeholder="https://drive.google.com/…"
            required
          />
        </div>

        <div>
          <Label>Duration</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              placeholder="0"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              required
              className="text-center"
            />
            <span className="shrink-0 text-xs text-muted">min</span>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              step="1"
              placeholder="0"
              value={durationSec}
              onChange={(e) =>
                setDurationSec(
                  e.target.value === "" ? "" : String(Math.min(59, Math.max(0, Number(e.target.value))))
                )
              }
              className="text-center"
            />
            <span className="shrink-0 text-xs text-muted">sec</span>
          </div>
        </div>

        <div className="grid grid-cols-1">
          {selectedStyle?.isCustomPricing ? (
            <div>
              <Label>Rate (Rs/min)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </div>
          ) : (
            <div>
              <Label>Rate</Label>
              <div className="flex h-[42px] items-center rounded-lg border border-border bg-surface-2 px-3.5 text-xs text-muted">
                {selectedStyle?.ratePerMinuteCents == null
                  ? "—"
                  : selectedStyle.perMinuteIncrementCents
                    ? `${formatCents(selectedStyle.ratePerMinuteCents)} min 1, +${formatCents(selectedStyle.perMinuteIncrementCents)} each min after`
                    : `${formatCents(selectedStyle.ratePerMinuteCents)}/min`}
              </div>
            </div>
          )}
        </div>

        {unlinked.length > 0 && (
          <div>
            <Label>Time logged for this video</Label>
            <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              <option value="">Don&rsquo;t attach any time</option>
              {unlinked.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label} — {u.minutes} min
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-muted-2">
              Pick the stretch you timed while working on this one.
            </p>
          </div>
        )}

        <div>
          <Label>Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything the owner should know"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Price
          </span>
          <span className="font-mono text-lg font-medium text-green">
            {livePriceCents !== null ? formatCents(livePriceCents) : "—"}
          </span>
        </div>

        {error && <p className="text-xs text-accent">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Submitting…" : "Submit video"}
        </Button>
      </form>
    </Modal>
  );
}
