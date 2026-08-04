"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatCents } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import type { FirstToday, LeaderboardResult } from "@/lib/leaderboard";

const MEDALS = ["🥇", "🥈", "🥉"];

interface LeaderboardResponse {
  batch: LeaderboardResult;
  batchNumber: number;
  currentBatch: number;
  batches: number[];
  monthly: LeaderboardResult;
  firstToday: FirstToday | null;
  batchBonusCents: number;
  monthlyBonusCents: number;
}

export function LeaderboardClient({ viewerEditorId }: { viewerEditorId?: string }) {
  const [mode, setMode] = useState<"batch" | "month">("batch");
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);

  const { data } = useSWR<LeaderboardResponse>(
    `/api/leaderboard${selectedBatch ? `?batch=${selectedBatch}` : ""}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const board = mode === "batch" ? data?.batch : data?.monthly;
  const bonusCents = mode === "batch" ? data?.batchBonusCents : data?.monthlyBonusCents;
  const activeBatch = selectedBatch ?? data?.currentBatch ?? null;
  const rows = board?.rows ?? [];
  const leader = rows.find((r) => r.score > 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-text">
          {mode === "batch" ? `Batch ${activeBatch ?? ""} Leaderboard` : "Monthly Leaderboard"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "batch"
            ? "Standings for this batch — frozen once the owner starts the next one."
            : "Resets on the 1st of every month."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMode("batch")}
          className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
            mode === "batch" ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
          }`}
        >
          By batch
        </button>
        <button
          onClick={() => setMode("month")}
          className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
            mode === "month" ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
          }`}
        >
          This month
        </button>
      </div>

      {mode === "batch" && data && data.batches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.batches.map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBatch(b)}
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                b === activeBatch
                  ? "bg-accent text-bg"
                  : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              Batch {b}
            </button>
          ))}
        </div>
      )}

      <Card className="flex items-center gap-4 border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-5">
        <span className="text-3xl">🏆</span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {mode === "batch" ? `Batch ${activeBatch ?? ""}'s` : "This month's"} bonus —{" "}
            {bonusCents !== undefined ? formatCents(bonusCents) : "…"}
          </p>
          <p className="font-display text-lg font-bold text-text">
            {leader ? leader.name : "No submissions yet"}
          </p>
        </div>
      </Card>

      {data?.firstToday && (
        <p className="flex items-center gap-2 font-mono text-xs text-muted">
          <span className="text-base">⚡</span>
          {data.firstToday.name} was first to submit today.
        </p>
      )}

      <Card className="divide-y divide-border">
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">No active editors yet.</p>
        )}
        {rows.map((row, i) => {
          const isYou = row.editorId === viewerEditorId;
          return (
            <div
              key={row.editorId}
              className={`flex items-center justify-between gap-4 p-4 ${isYou ? "bg-accent/5" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className="w-7 text-center font-mono text-sm text-muted">
                  {MEDALS[i] ?? i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-text">
                    {row.name}
                    {isYou && (
                      <span className="ml-2 rounded-full border border-accent px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
                        you
                      </span>
                    )}
                    {row.streak >= 2 && (
                      <span className="ml-2 font-mono text-xs text-muted">
                        🔥 {row.streak}d streak
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {row.videoCount} video{row.videoCount === 1 ? "" : "s"} · {row.activeDays} day
                    {row.activeDays === 1 ? "" : "s"} active
                  </p>
                </div>
              </div>
              <span className="font-mono text-lg font-bold text-text">{row.score}</span>
            </div>
          );
        })}
      </Card>

      <p className="text-xs text-muted">
        Score = 10 points per video + 15 points per day you submitted at least one video. Rejected
        submissions don&rsquo;t count.
      </p>
    </div>
  );
}
