"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WorkItem {
  id: string;
  label: string;
  status: "working" | "submitted";
  submissionId: string | null;
  minutes: number;
  runningSince: string | null;
}

function clock(minutes: number, runningSince: string | null, now: number): string {
  const live = runningSince ? Math.max(0, now - new Date(runningSince).getTime()) : 0;
  // `minutes` already includes the open span, so only the sub-minute remainder
  // is added back — otherwise the running span would be counted twice.
  const total = Math.floor((minutes * 60000 + (live % 60000)) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * The editor's clock, across a video's whole life.
 *
 * Start -> Submitted -> (Resume for revisions -> Submitted)* -> Finish
 *
 * Finish is the only step that can't be undone from the portal, so it asks the
 * editor to type the word out. Everything else is one tap.
 */
export function WorkTimer() {
  const { data, mutate } = useSWR<{ items: WorkItem[] }>("/api/work-items", fetcher, {
    refreshInterval: 30000,
  });
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [finishing, setFinishing] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const items = data?.items ?? [];
  const running = items.find((i) => i.status === "working") ?? null;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  async function start() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/work-items", {
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

  async function act(id: string, action: "submit" | "resume" | "finish", confirm?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/work-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(confirm ? { confirm } : {}) }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Could not update.");
        return;
      }
      setFinishing(null);
      setConfirmText("");
      await mutate();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <Card
          key={item.id}
          className={`flex flex-col gap-3 p-4 ${
            item.status === "working" ? "border-accent/50" : ""
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
                {item.status === "working" ? (
                  <>
                    <span className="status-dot" />
                    <span className="text-accent">Working on</span>
                  </>
                ) : (
                  <span className="text-muted">With QA — resume if changes come back</span>
                )}
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-text">{item.label}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xl tabular-nums text-text">
                {clock(item.minutes, item.runningSince, now)}
              </span>
              {item.status === "working" ? (
                <Button size="sm" disabled={busy} onClick={() => act(item.id, "submit")}>
                  Submitted
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => act(item.id, "resume")}
                  >
                    Resume work
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      setFinishing(finishing === item.id ? null : item.id);
                      setConfirmText("");
                      setError(null);
                    }}
                  >
                    Finish
                  </Button>
                </>
              )}
            </div>
          </div>

          {finishing === item.id && (
            <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
              <p className="text-xs text-text">
                Finishing locks <span className="font-medium">{item.label}</span> — no more time
                can be added and you can&rsquo;t resume it. Type <b>finish</b> to confirm.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  autoFocus
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && confirmText.trim().toLowerCase() === "finish") {
                      void act(item.id, "finish", confirmText);
                    }
                  }}
                  placeholder="finish"
                  className="!w-32"
                />
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy || confirmText.trim().toLowerCase() !== "finish"}
                  onClick={() => act(item.id, "finish", confirmText)}
                >
                  Finish for good
                </Button>
                <Button size="sm" variant="outline" onClick={() => setFinishing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {!running && (
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

      {error && <p className="px-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
