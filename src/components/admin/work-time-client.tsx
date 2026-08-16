"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date";

interface WorkTimeRow {
  id: string;
  label: string;
  editorName: string;
  minutes: number;
  spans: number;
  cappedSpans: number;
  approved: boolean;
  finishedAt: string | null;
  submission: { id: string; title: string; durationMinutes: number; status: string } | null;
  minutesPerFinishedMinute: number | null;
}

function formatWorked(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * QA signs off the hours an editor logged. Nothing reaches the leaderboard
 * until it passes through here — the clock is self-reported, so it needs a
 * second pair of eyes before it can move money.
 */
export function WorkTimeClient() {
  const [pending, setPending] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, mutate } = useSWR<{ items: WorkTimeRow[] }>(
    `/api/admin/work-time?pending=${pending}`,
    fetcher,
    { refreshInterval: 15000 },
  );
  const items = data?.items ?? [];

  async function setApproved(id: string, approved: boolean) {
    setBusy(id);
    try {
      await fetch("/api/admin/work-time", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved }),
      });
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {[
          { value: true, label: "Waiting on you" },
          { value: false, label: "All finished work" },
        ].map((t) => (
          <button
            key={String(t.value)}
            onClick={() => setPending(t.value)}
            className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              pending === t.value ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-border">
        {items.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            {pending ? "Nothing waiting — all logged time is signed off." : "No finished work yet."}
          </p>
        )}
        {items.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">
                {i.submission?.title ?? i.label}
                {!i.submission && (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-warning">
                    no video attached
                  </span>
                )}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted">
                {i.editorName} · {formatWorked(i.minutes)} over {i.spans} session
                {i.spans === 1 ? "" : "s"}
                {i.minutesPerFinishedMinute != null && (
                  <span className="text-text">
                    {" "}
                    · {i.minutesPerFinishedMinute.toFixed(0)} min per finished minute
                  </span>
                )}
                {i.finishedAt && ` · finished ${formatDate(i.finishedAt)}`}
              </p>
              {i.cappedSpans > 0 && (
                <p className="mt-0.5 font-mono text-[11px] text-accent">
                  {i.cappedSpans} session{i.cappedSpans === 1 ? "" : "s"} hit the 6h cap — likely a
                  timer left running
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {i.approved ? (
                <>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-green">
                    Approved
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === i.id}
                    onClick={() => setApproved(i.id, false)}
                  >
                    Undo
                  </Button>
                </>
              ) : (
                <Button size="sm" disabled={busy === i.id} onClick={() => setApproved(i.id, true)}>
                  Approve time
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>

      <p className="text-xs leading-relaxed text-muted-2">
        Time only counts toward the leaderboard once it&rsquo;s approved here. Check the pace looks
        believable for the length of the video before signing it off.
      </p>
    </div>
  );
}
