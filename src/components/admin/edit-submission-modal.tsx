"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { calculatePriceCents, formatCents } from "@/lib/pricing";
import { decimalToMinutesSeconds, minutesSecondsToDecimal } from "@/lib/duration";
import type { Style, Submission } from "@/lib/types";

/**
 * Parent must render this with `key={submission?.id ?? "none"}` so a new
 * submission remounts the form fresh instead of needing an effect to
 * resync state from props.
 */
export function EditSubmissionModal({
  submission,
  styles,
  onClose,
  onSaved,
}: {
  submission: Submission | null;
  styles: Style[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialDuration = submission
    ? decimalToMinutesSeconds(submission.durationMinutes)
    : { minutes: 0, seconds: 0 };

  const [title, setTitle] = useState(submission?.title ?? "");
  const [clientOrProject, setClientOrProject] = useState(submission?.clientOrProject ?? "");
  const [videoLink, setVideoLink] = useState(submission?.videoLink ?? "");
  const [durationMin, setDurationMin] = useState(String(initialDuration.minutes));
  const [durationSec, setDurationSec] = useState(String(initialDuration.seconds));
  const [notes, setNotes] = useState(submission?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!submission) return null;

  const style = styles.find((s) => s.id === submission.styleId);
  const minPart = parseInt(durationMin || "0", 10);
  const secPart = parseInt(durationSec || "0", 10);
  const parsedDuration = minutesSecondsToDecimal(minPart, secPart);
  const livePriceCents = calculatePriceCents(
    parsedDuration,
    submission.pricePerMinuteCents,
    style?.perMinuteIncrementCents ?? 0
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!submission) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          clientOrProject,
          videoLink,
          notes,
          durationMinutes: parsedDuration,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not save.");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={submission !== null} onClose={onClose} title="Edit submission">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div>
          <Label>Client / Project</Label>
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
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              className="text-center"
            />
            <span className="shrink-0 text-xs text-muted">min</span>
            <Input
              type="number"
              inputMode="numeric"
              min="0"
              max="59"
              step="1"
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

        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Recalculated price
          </span>
          <span className="font-mono text-lg font-medium text-green">
            {formatCents(livePriceCents)}
          </span>
        </div>

        {error && <p className="text-xs text-accent">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
