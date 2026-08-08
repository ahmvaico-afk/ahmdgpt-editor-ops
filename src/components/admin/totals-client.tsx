"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatCents } from "@/lib/pricing";
import { formatDuration } from "@/lib/duration";
import { formatDate } from "@/lib/date";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { BatchInfo } from "@/lib/types";

interface EditorTotal {
  editorId: string;
  name: string;
  editorCode: string;
  active: boolean;
  videoCount: number;
  totalDurationMinutes: number;
  totalCents: number;
}

export function TotalsClient() {
  const [batch, setBatch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: batchesData } = useSWR<{ currentBatch: number; batches: BatchInfo[] }>(
    "/api/admin/batches",
    fetcher,
    { refreshInterval: 15000 }
  );
  const { data } = useSWR<{
    totals: EditorTotal[];
    grandTotalCents: number;
    grandVideoCount: number;
  }>(`/api/admin/editor-totals${batch ? `?batch=${batch}` : ""}`, fetcher, {
    refreshInterval: 15000,
  });

  const totals = data?.totals ?? [];
  const batches = batchesData?.batches ?? [];
  // Same union as the dashboard tabs: a batch you've just opened has no
  // submissions yet, so grouping alone would leave it out.
  const batchTabs = batchesData
    ? Array.from(new Set([...batches.map((b) => b.number), batchesData.currentBatch])).sort(
        (a, b) => b - a
      )
    : [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="font-display text-2xl font-extrabold text-text">Editor Totals</h1>
      <p className="-mt-4 text-sm text-muted">
        Click an editor to see every video they&rsquo;ve submitted, with duration and price.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setBatch("");
              setExpanded(null);
            }}
            className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              batch === "" ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
            }`}
          >
            All batches
          </button>
          {batchTabs.map((number) => (
            <button
              key={number}
              onClick={() => {
                setBatch(String(number));
                setExpanded(null);
              }}
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                batch === String(number)
                  ? "bg-accent text-bg"
                  : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              Batch {number}
            </button>
          ))}
        </div>
        {data && (
          <p className="font-mono text-xs text-muted">
            {batch ? `Batch ${batch}` : "All batches"} · {data.grandVideoCount} video
            {data.grandVideoCount === 1 ? "" : "s"} ·{" "}
            <span className="text-green">{formatCents(data.grandTotalCents)}</span>
          </p>
        )}
      </div>

      <Card className="divide-y divide-border">
        {totals.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            {batch ? `Nobody submitted anything in Batch ${batch}.` : "No editors yet."}
          </p>
        )}
        {totals.map((t) => (
          <div key={t.editorId}>
            <button
              onClick={() => setExpanded(expanded === t.editorId ? null : t.editorId)}
              className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-text">
                  {t.name}
                  {!t.active && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted-2">
                      inactive
                    </span>
                  )}
                </p>
                <p className="font-mono text-xs text-muted">{t.editorCode}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Videos
                  </p>
                  <p className="text-sm text-text">{t.videoCount}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Duration
                  </p>
                  <p className="text-sm text-text">{formatDuration(t.totalDurationMinutes)}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    Total
                  </p>
                  <p className="font-mono text-sm font-medium text-green">
                    {formatCents(t.totalCents)}
                  </p>
                </div>
                <span className="text-muted">{expanded === t.editorId ? "▲" : "▼"}</span>
              </div>
            </button>
            {expanded === t.editorId && (
              <EditorVideoList editorId={t.editorId} batch={batch} />
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

interface SubmissionRow {
  id: string;
  title: string;
  styleName: string;
  durationMinutes: number;
  calculatedPriceCents: number;
  status: string;
  batchNumber: number;
  submittedAt: string;
}

function EditorVideoList({ editorId, batch }: { editorId: string; batch: string }) {
  const { data } = useSWR<{ items: SubmissionRow[] }>(
    `/api/submissions?editorId=${editorId}&page=1${batch ? `&batch=${batch}` : ""}`,
    fetcher
  );
  const items = data?.items ?? [];

  return (
    <div className="divide-y divide-border border-t border-border bg-surface-2/50 px-4">
      {items.length === 0 && <p className="py-4 text-center text-xs text-muted">No videos.</p>}
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-text">{item.title}</p>
            <p className="font-mono text-xs text-muted">
              {item.styleName} · {formatDuration(item.durationMinutes)} · Batch{" "}
              {item.batchNumber} · {formatDate(item.submittedAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-text">
              {formatCents(item.calculatedPriceCents)}
            </span>
            <StatusBadge status={item.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
