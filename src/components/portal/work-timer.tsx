"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

interface OpenSession {
  id: string;
  submissionId: string;
  title: string;
  startedAt: string;
}

interface SubmissionOption {
  id: string;
  title: string;
  status: string;
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
 * Start/stop clock for the video an editor is currently working on.
 *
 * Stops at submit, not at approval — QA's review queue is never charged to the
 * editor. If a video comes back for changes, starting it again opens a fresh
 * span and the total is the sum.
 */
export function WorkTimer({ submissions }: { submissions: SubmissionOption[] }) {
  const { data, mutate } = useSWR<{ session: OpenSession | null }>(
    "/api/work-sessions",
    fetcher,
    { refreshInterval: 30000 },
  );
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const open = data?.session ?? null;

  // Ticks only while something is running, so an idle dashboard stays quiet.
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  async function start() {
    if (!choice) return;
    setBusy(true);
    try {
      await fetch("/api/work-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: choice }),
      });
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

  if (open) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 border-accent/40 p-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-accent">
            <span className="status-dot" />
            Working on
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-text">{open.title}</p>
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
    );
  }

  return (
    <Card className="flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-0 flex-1">
        <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted">
          Start working on
        </label>
        <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="">Pick a video…</option>
          {submissions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
              {s.status === "rejected" ? " (needs changes)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <Button disabled={busy || !choice} onClick={start}>
        Start
      </Button>
    </Card>
  );
}
