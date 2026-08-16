"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatCents } from "@/lib/pricing";
import { formatDuration } from "@/lib/duration";
import { formatDate } from "@/lib/date";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { AddVideoModal } from "@/components/portal/add-video-modal";
import { WorkTimer } from "@/components/portal/work-timer";
import { EditSubmissionModal } from "@/components/edit-submission-modal";
import type { EditorSummary, Style, Submission } from "@/lib/types";

export function DashboardClient({
  editorName,
  editorCode,
  isQa = false,
}: {
  editorName: string;
  editorCode: string;
  /** Owner-granted QA hat — unlocks the review desk link. */
  isQa?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Submission | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);

  const { data: summary, mutate: mutateSummary } = useSWR<EditorSummary>(
    "/api/submissions/summary",
    fetcher,
    { refreshInterval: 8000 }
  );
  const { data: stylesData } = useSWR<{ styles: Style[] }>("/api/styles", fetcher, {
    refreshInterval: 15000,
  });
  const { data: batchData } = useSWR<{ currentBatch: number; editorBatches: number[] }>(
    "/api/batch",
    fetcher,
    { refreshInterval: 15000 }
  );
  const activeBatch = selectedBatch ?? batchData?.currentBatch ?? null;
  const { data: submissionsData, mutate: mutateSubmissions } = useSWR<{
    items: Submission[];
    total: number;
  }>(activeBatch ? `/api/submissions?batch=${activeBatch}&all=true` : null, fetcher, {
    refreshInterval: 8000,
  });
  const { data: personalStats } = useSWR<{
    bestDayCount: number;
    bestDayDate: string | null;
    currentStreak: number;
    firstToday: boolean;
  }>("/api/personal-stats", fetcher, { refreshInterval: 15000 });

  function refreshAll() {
    mutateSummary();
    mutateSubmissions();
  }

  async function removeSubmission(id: string) {
    if (!confirm("Remove this video? This can't be undone.")) return;
    await fetch(`/api/submissions/${id}`, { method: "DELETE" });
    refreshAll();
  }

  const styles = stylesData?.styles ?? [];
  const items = submissionsData?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Welcome back
          </p>
          <h1 className="font-display text-2xl font-extrabold text-text">{editorName}</h1>
          {batchData && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
              <span className="status-dot" />
              Adding to Batch {batchData.currentBatch}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isQa && (
            <Link
              href={`/portal/${editorCode}/qa`}
              className="rounded-full bg-gold/15 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-gold transition-colors hover:bg-gold/25"
            >
              QA Review
            </Link>
          )}
          <Link
            href={`/portal/${editorCode}/meters`}
            className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-text"
          >
            Meters
          </Link>
          <Link
            href={`/portal/${editorCode}/hook-tool`}
            className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-text"
          >
            Hook Text
          </Link>
          <Link
            href={`/portal/${editorCode}/leaderboard`}
            className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-text"
          >
            Leaderboard
          </Link>
          <Link
            href={`/portal/${editorCode}/invoice`}
            className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-text"
          >
            Generate Invoice
          </Link>
          <Button onClick={() => setModalOpen(true)}>+ Add Video</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="This month" value={formatCents(summary?.thisMonth.totalCents ?? 0)} />
        <StatCard label="All time" value={formatCents(summary?.allTime.totalCents ?? 0)} />
        <StatCard
          label="Pending"
          value={String(
            (summary?.byStatus.find((s) => s.status === "submitted")?.count ?? 0) +
              (summary?.byStatus.find((s) => s.status === "approved")?.count ?? 0)
          )}
        />
        <StatCard
          label="Paid"
          value={String(summary?.byStatus.find((s) => s.status === "paid")?.count ?? 0)}
        />
      </div>

      {/* Sits above everything else: a timer you can't see is a timer you
          forget to stop, and forgotten timers wreck the meter maths. */}
      <WorkTimer />

      {personalStats && personalStats.currentStreak >= 1 && (
        <StreakBar streak={personalStats.currentStreak} />
      )}

      {personalStats && (personalStats.firstToday || personalStats.bestDayCount > 0) && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {personalStats.firstToday && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-2.5 py-1 text-accent">
              ⚡ First to submit today
            </span>
          )}
          {personalStats.bestDayCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-muted">
              🏅 Your record: {personalStats.bestDayCount} video
              {personalStats.bestDayCount === 1 ? "" : "s"} in one day
            </span>
          )}
        </div>
      )}

      <Card className="divide-y divide-border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Your submissions
          </h2>
          {batchData && batchData.editorBatches.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {batchData.editorBatches.map((b) => (
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
        </div>
        {items.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            {activeBatch ? `No submissions in Batch ${activeBatch} yet.` : "No submissions yet."}
          </p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{item.title}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted">
                {item.styleName} · {formatDuration(item.durationMinutes)}
                {item.clientOrProject ? ` · ${item.clientOrProject}` : ""} ·{" "}
                {formatDate(item.submittedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-mono text-sm text-text">
                {formatCents(item.calculatedPriceCents)}
              </span>
              <StatusBadge status={item.status} />
              {item.status === "submitted" && (
                <>
                  <button
                    onClick={() => setEditTarget(item)}
                    className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-text"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeSubmission(item.id)}
                    aria-label="Remove video"
                    className="text-muted transition-colors hover:text-accent"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </Card>

      <AddVideoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        styles={styles}
        onCreated={refreshAll}
        currentBatch={batchData?.currentBatch}
      />

      <EditSubmissionModal
        key={editTarget?.id ?? "none"}
        submission={editTarget}
        styles={styles}
        onClose={() => setEditTarget(null)}
        onSaved={refreshAll}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-text">{value}</p>
    </Card>
  );
}

const STREAK_MILESTONE = 7;

function StreakBar({ streak }: { streak: number }) {
  const progress = Math.min(streak / STREAK_MILESTONE, 1) * 100;
  const complete = streak >= STREAK_MILESTONE;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">🔥 Streak</p>
        <p className="font-mono text-xs text-text">
          {streak} day{streak === 1 ? "" : "s"}
          {complete ? " 🏆" : ` · ${STREAK_MILESTONE - streak} to go`}
        </p>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-gold transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </Card>
  );
}
