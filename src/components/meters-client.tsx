"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { MeterGauge } from "@/components/meter-gauge";

interface Meter {
  editorId: string;
  name: string;
  editorCode: string;
  videoCount: number;
  meter: number;
  editorRevisions: number;
  briefRevisions: number;
  firstTimePassRate: number;
  activeMinutes: number;
  minutesPerFinishedMinute: number | null;
  rupeesPerHour: number | null;
  ranked: boolean;
  flaggedSessions: number;
}

interface Payload {
  meters: Meter[];
  batchNumber: number | null;
  currentBatch: number;
  batches: number[];
  revisionCost: Record<string, number>;
  minVideosForRanking: number;
  viewerEditorId: string | null;
}

function formatWorked(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function MetersClient({ showFlags = false }: { showFlags?: boolean }) {
  const [batch, setBatch] = useState<string | null>(null);
  const { data } = useSWR<Payload>(
    `/api/meters${batch ? `?batch=${batch}` : ""}`,
    fetcher,
    { refreshInterval: 20000 },
  );

  const meters = data?.meters ?? [];
  const active = batch ?? (data ? String(data.batchNumber ?? "all") : "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setBatch("all")}
            className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              active === "all" ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
            }`}
          >
            All time
          </button>
          {(data?.batches ?? []).map((n) => (
            <button
              key={n}
              onClick={() => setBatch(String(n))}
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                active === String(n)
                  ? "bg-accent text-bg"
                  : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              Batch {n}
            </button>
          ))}
        </div>
      </div>

      {meters.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted">
          No scored videos yet in this batch.
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {meters.map((m) => {
          const you = m.editorId === data?.viewerEditorId;
          return (
            <Card
              key={m.editorId}
              className={`flex flex-col items-center gap-3 p-4 ${
                you ? "border-accent/50" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium text-text">{m.name}</p>
                {you && (
                  <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-bg">
                    You
                  </span>
                )}
                {!m.ranked && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                    too few videos
                  </span>
                )}
              </div>

              <MeterGauge value={m.meter} size={210} />

              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-center font-mono text-[11px] text-muted">
                <span>
                  {m.videoCount} video{m.videoCount === 1 ? "" : "s"}
                </span>
                <span>{Math.round(m.firstTimePassRate * 100)}% first-time pass</span>
                <span className={m.editorRevisions > 0 ? "text-warning" : undefined}>
                  {m.editorRevisions} revision{m.editorRevisions === 1 ? "" : "s"}
                </span>
                {m.briefRevisions > 0 && (
                  <span className="text-muted-2">
                    {m.briefRevisions} brief change{m.briefRevisions === 1 ? "" : "s"} (free)
                  </span>
                )}
                {m.activeMinutes > 0 && <span>{formatWorked(m.activeMinutes)} worked</span>}
                {m.minutesPerFinishedMinute != null && (
                  <span className="text-text">
                    {m.minutesPerFinishedMinute.toFixed(0)} min per finished minute
                  </span>
                )}
                {showFlags && m.flaggedSessions > 0 && (
                  <span className="text-accent">
                    {m.flaggedSessions} capped session{m.flaggedSessions === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {data && (
        <p className="text-xs leading-relaxed text-muted-2">
          Everyone starts at 100%. A revision that was the editor&rsquo;s mistake costs{" "}
          <span className="text-muted">{data.revisionCost["1"]}%</span> if minor,{" "}
          <span className="text-muted">{data.revisionCost["2"]}%</span> if moderate and{" "}
          <span className="text-muted">{data.revisionCost["3"]}%</span> if major — averaged
          across your videos, so doing more work never drags your score down. Revisions caused
          by a changed brief cost nothing. Time is only counted while you have the timer
          running, never while QA is reviewing.
        </p>
      )}
    </div>
  );
}
