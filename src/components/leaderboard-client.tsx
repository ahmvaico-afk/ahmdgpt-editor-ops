"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatDate } from "@/lib/date";
import { formatCents } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import type { FirstToday, LeaderboardResult } from "@/lib/leaderboard";

const MEDALS = ["🥇", "🥈", "🥉"];

interface LeaderboardResponse {
  weekly: LeaderboardResult;
  monthly: LeaderboardResult;
  firstToday: FirstToday | null;
  weeklyBonusCents: number;
  monthlyBonusCents: number;
}

export function LeaderboardClient({ viewerEditorId }: { viewerEditorId?: string }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const { data } = useSWR<LeaderboardResponse>("/api/leaderboard", fetcher, {
    refreshInterval: 15000,
  });

  const board = period === "week" ? data?.weekly : data?.monthly;
  const bonusCents = period === "week" ? data?.weeklyBonusCents : data?.monthlyBonusCents;
  const rows = board?.rows ?? [];
  const leader = rows.find((r) => r.score > 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-text">
          {period === "week" ? "Weekly" : "Monthly"} Leaderboard
        </h1>
        {board && (
          <p className="mt-1 text-sm text-muted">
            {formatDate(board.rangeStart)} –{" "}
            {formatDate(new Date(new Date(board.rangeEnd).getTime() - 86400000))}
            {" · "}
            {period === "week" ? "resets every Monday" : "resets on the 1st"}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setPeriod("week")}
          className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
            period === "week" ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
          }`}
        >
          This week
        </button>
        <button
          onClick={() => setPeriod("month")}
          className={`rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
            period === "month" ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
          }`}
        >
          This month
        </button>
      </div>

      <Card className="flex items-center gap-4 border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-5">
        <span className="text-3xl">🏆</span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {period === "week" ? "This week's" : "This month's"} bonus —{" "}
            {bonusCents !== undefined ? formatCents(bonusCents) : "…"}
          </p>
          <p className="font-display text-lg font-bold text-text">
            {leader ? leader.name : `No submissions yet this ${period}`}
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
