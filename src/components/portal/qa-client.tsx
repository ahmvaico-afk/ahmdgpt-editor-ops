"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { RevisionModal, type RevisionTarget } from "@/components/admin/revision-modal";
import { WorkTimeClient } from "@/components/admin/work-time-client";
import { formatDuration } from "@/lib/duration";
import { formatDate } from "@/lib/date";
import type { SubmissionStatus } from "@/lib/types";

type Tab = "videos" | "time";

/** What /api/qa/queue returns — no rates, no payouts. */
interface QaVideo {
  id: string;
  title: string;
  styleName: string;
  videoLink: string;
  durationMinutes: number;
  status: SubmissionStatus;
  submittedAt: string;
  editor: { name: string } | null;
  _count: { revisions: number };
}

/**
 * The QA editor's review desk. Same building blocks the owner uses, minus
 * anything to do with money — this screen never shows a rate or a payout.
 */
export function QaClient() {
  const [tab, setTab] = useState<Tab>("videos");
  const [revisionTarget, setRevisionTarget] = useState<RevisionTarget | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, mutate } = useSWR<{ items: QaVideo[] }>("/api/qa/queue", fetcher, {
    refreshInterval: 10000,
  });
  const items = data?.items ?? [];

  async function setStatus(id: string, status: SubmissionStatus) {
    setBusy(id);
    try {
      await fetch(`/api/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            { value: "videos", label: "Videos to review" },
            { value: "time", label: "Time approvals" },
          ] as { value: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              tab === t.value ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "time" ? (
        <WorkTimeClient />
      ) : (
        <Card className="divide-y divide-border">
          {items.length === 0 && (
            <p className="p-6 text-center text-sm text-muted">Nothing waiting for review.</p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{item.title}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-muted">
                  {item.editor?.name ?? "—"} · {item.styleName} ·{" "}
                  {formatDuration(item.durationMinutes)} · {formatDate(item.submittedAt)}
                </p>
                <a
                  href={item.videoLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-block font-mono text-xs text-accent hover:text-accent-light"
                >
                  View video →
                </a>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <StatusBadge status={item.status} />
                <button
                  onClick={() => setRevisionTarget(item)}
                  className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-warning"
                >
                  Revision
                </button>
                <Button
                  size="sm"
                  disabled={busy === item.id}
                  onClick={() => setStatus(item.id, "approved")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy === item.id}
                  onClick={() => setStatus(item.id, "rejected")}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <RevisionModal
        key={revisionTarget?.id ?? "none"}
        submission={revisionTarget}
        onClose={() => setRevisionTarget(null)}
        onSaved={() => mutate()}
      />
    </div>
  );
}
