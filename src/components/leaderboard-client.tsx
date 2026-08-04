"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatDate } from "@/lib/date";
import { Card } from "@/components/ui/card";
import type { LeaderboardResult } from "@/lib/leaderboard";

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardClient({ viewerEditorId }: { viewerEditorId?: string }) {
  const { data } = useSWR<LeaderboardResult>("/api/leaderboard", fetcher, {
    refreshInterval: 15000,
  });

  const rows = data?.rows ?? [];
  const leader = rows.find((r) => r.score > 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-text">Weekly Leaderboard</h1>
        {data && (
          <p className="mt-1 text-sm text-muted">
            {formatDate(data.weekStart)} – {formatDate(new Date(new Date(data.weekEnd).getTime() - 86400000))}
            {" · "}resets every Monday
          </p>
        )}
      </div>

      <Card className="flex items-center gap-4 border-gold/40 bg-gradient-to-br from-gold/10 to-transparent p-5">
        <span className="text-3xl">🏆</span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
            This week&rsquo;s bonus — Rs 5,000
          </p>
          <p className="font-display text-lg font-bold text-text">
            {leader ? leader.name : "No submissions yet this week"}
          </p>
        </div>
      </Card>

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
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {row.videoCount} video{row.videoCount === 1 ? "" : "s"} · {row.activeDays}/7 days
                    active
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
