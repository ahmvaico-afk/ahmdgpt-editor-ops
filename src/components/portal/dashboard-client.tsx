"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatCents } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { AddVideoModal } from "@/components/portal/add-video-modal";
import type { EditorSummary, Style, Submission } from "@/lib/types";

export function DashboardClient({ editorName }: { editorName: string }) {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: summary, mutate: mutateSummary } = useSWR<EditorSummary>(
    "/api/submissions/summary",
    fetcher,
    { refreshInterval: 8000 }
  );
  const { data: stylesData } = useSWR<{ styles: Style[] }>("/api/styles", fetcher, {
    refreshInterval: 15000,
  });
  const { data: submissionsData, mutate: mutateSubmissions } = useSWR<{
    items: Submission[];
    total: number;
  }>("/api/submissions", fetcher, { refreshInterval: 8000 });

  function refreshAll() {
    mutateSummary();
    mutateSubmissions();
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
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Add Video</Button>
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

      <Card className="divide-y divide-border">
        <div className="p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Your submissions
          </h2>
        </div>
        {items.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            No submissions yet. Add your first video above.
          </p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{item.title}</p>
              <p className="mt-0.5 truncate font-mono text-xs text-muted">
                {item.styleName}
                {item.clientOrProject ? ` · ${item.clientOrProject}` : ""} ·{" "}
                {new Date(item.submittedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-mono text-sm text-text">
                {formatCents(item.calculatedPriceCents)}
              </span>
              <StatusBadge status={item.status} />
            </div>
          </div>
        ))}
      </Card>

      <AddVideoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        styles={styles}
        onCreated={refreshAll}
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
