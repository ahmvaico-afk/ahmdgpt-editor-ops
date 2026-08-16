"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatDate } from "@/lib/date";

/**
 * Only what the modal actually needs. Kept narrow on purpose so QA can pass a
 * queue row that carries no rates or payouts.
 */
export interface RevisionTarget {
  id: string;
  title: string;
}

// Duplicated rather than imported from lib/meters: that module pulls in the
// Prisma client, which must not reach the browser bundle.
const SEVERITY_LABELS: Record<number, string> = {
  1: "Minor",
  2: "Moderate",
  3: "Major",
};

interface Revision {
  id: string;
  severity: number;
  reason: "editor_error" | "brief_change";
  note: string | null;
  createdAt: string;
}

/**
 * QA logs a round of changes against a video.
 *
 * Two questions, deliberately: how bad, and whose fault. Without the second
 * one an editor gets marked down because a client changed their mind, which is
 * the fastest way to make the whole score feel rigged.
 */
export function RevisionModal({
  submission,
  onClose,
  onSaved,
}: {
  submission: RevisionTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [severity, setSeverity] = useState(1);
  const [reason, setReason] = useState<"editor_error" | "brief_change">("editor_error");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, mutate } = useSWR<{ revisions: Revision[] }>(
    submission ? `/api/admin/submissions/${submission.id}/revisions` : null,
    fetcher,
  );

  if (!submission) return null;
  const revisions = data?.revisions ?? [];

  async function add() {
    if (!submission) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submission.id}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity, reason, note: note.trim() || undefined }),
      });
      if (res.ok) {
        setNote("");
        setSeverity(1);
        await mutate();
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!submission) return;
    await fetch(`/api/admin/submissions/${submission.id}/revisions?revisionId=${id}`, {
      method: "DELETE",
    });
    await mutate();
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-text">Log a revision</h2>
            <p className="mt-0.5 truncate text-sm text-muted">{submission.title}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 font-mono text-xs uppercase tracking-wider text-muted hover:text-text"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <Label>How bad</Label>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                    severity === s ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
                  }`}
                >
                  {SEVERITY_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Whose fault</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setReason("editor_error")}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  reason === "editor_error"
                    ? "bg-accent text-bg"
                    : "bg-surface-2 text-muted hover:text-text"
                }`}
              >
                Editor error
              </button>
              <button
                onClick={() => setReason("brief_change")}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                  reason === "brief_change"
                    ? "bg-accent text-bg"
                    : "bg-surface-2 text-muted hover:text-text"
                }`}
              >
                Brief change
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted-2">
              {reason === "editor_error"
                ? "Counts against the editor's meter."
                : "Recorded, but costs the editor nothing."}
            </p>
          </div>

          <div>
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What needs changing?"
              maxLength={400}
            />
          </div>

          <Button disabled={busy} onClick={add}>
            {busy ? "Saving…" : "Log revision"}
          </Button>
        </div>

        {revisions.length > 0 && (
          <div className="mt-6">
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Already logged ({revisions.length})
            </h3>
            <div className="mt-2 divide-y divide-border rounded-lg border border-border">
              {revisions.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-text">
                      {SEVERITY_LABELS[r.severity]} ·{" "}
                      <span
                        className={
                          r.reason === "editor_error" ? "text-warning" : "text-muted-2"
                        }
                      >
                        {r.reason === "editor_error" ? "editor error" : "brief change"}
                      </span>
                    </p>
                    {r.note && <p className="mt-0.5 truncate text-xs text-muted">{r.note}</p>}
                    <p className="mt-0.5 font-mono text-[10px] text-muted-2">
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(r.id)}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
