"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OpenSession {
  id: string;
  label: string;
  startedAt: string;
}

export interface UnlinkedSession {
  id: string;
  label: string;
  minutes: number;
}

function elapsed(from: string, now: number): string {
  const ms = Math.max(0, now - new Date(from).getTime());
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Start/stop clock for the video an editor is working on right now.
 *
 * The editor names the video here, before it exists as a submission — they add
 * it properly, with its duration, once the work is finished, and pick this
 * timing then. The clock stops at submit, never at approval, so QA's review
 * queue is not charged to the editor.
 */
export function WorkTimer() {
  const { data, mutate } = useSWR<{ session: OpenSession | null; unlinked: UnlinkedSession[] }>(
    "/api/work-sessions",
    fetcher,
    { refreshInterval: 30000 },
  );
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const open = data?.session ?? null;
  const waiting = data?.unlinked ?? [];

  // Ticks only while something is running, so an idle dashboard stays quiet.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  async function start() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/work-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      setLabel("");
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await fetch("/api/work-sessions", { method: "DELETE" });
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {open ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/50 p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-accent">
              <span className="status-dot" />
              Working on
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-text">{open.label}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl tabular-nums text-text">
              {elapsed(open.startedAt, now)}
            </span>
            <Button size="sm" variant="danger" disabled={busy} onClick={stop}>
              Stop
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted">
              Start the clock on
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && label.trim()) void start();
              }}
              placeholder="e.g. Rosabella #2"
              maxLength={120}
            />
          </div>
          <Button disabled={busy || !label.trim()} onClick={start}>
            Start
          </Button>
        </Card>
      )}

      {waiting.length > 0 && (
        <p className="px-1 font-mono text-[11px] text-muted">
          {waiting.length} timed session{waiting.length === 1 ? "" : "s"} waiting to be attached —
          pick one when you add the video.
        </p>
      )}
    </div>
  );
}
