"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatCents } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryCards } from "@/components/admin/summary-cards";
import { BatchManager } from "@/components/admin/batch-manager";
import { EditSubmissionModal } from "@/components/edit-submission-modal";
import { formatDuration } from "@/lib/duration";
import { formatDate } from "@/lib/date";
import type { AdminEditor, BatchInfo, Style, Submission, SubmissionStatus } from "@/lib/types";

const STATUSES: SubmissionStatus[] = ["submitted", "approved", "paid", "rejected"];

export function AdminDashboardClient() {
  const [editorId, setEditorId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [status, setStatus] = useState("");
  const [batch, setBatch] = useState("");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<Submission | null>(null);

  const { data: editorsData } = useSWR<{ editors: AdminEditor[] }>(
    "/api/admin/editors",
    fetcher
  );
  const { data: stylesData } = useSWR<{ styles: Style[] }>("/api/admin/styles", fetcher);
  const { data: batchesData, mutate: mutateBatches } = useSWR<{
    currentBatch: number;
    batches: BatchInfo[];
  }>("/api/admin/batches", fetcher, { refreshInterval: 10000 });

  const params = new URLSearchParams();
  if (editorId) params.set("editorId", editorId);
  if (styleId) params.set("styleId", styleId);
  if (status) params.set("status", status);
  if (batch) params.set("batch", batch);
  params.set("page", String(page));

  const { data, mutate } = useSWR<{ items: Submission[]; total: number; pageSize: number }>(
    `/api/submissions?${params.toString()}`,
    fetcher,
    { refreshInterval: 6000 }
  );

  const editors = editorsData?.editors ?? [];
  const styles = stylesData?.styles ?? [];
  const batches = batchesData?.batches ?? [];
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function updateStatus(id: string, next: SubmissionStatus) {
    await fetch(`/api/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    mutate();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="font-display text-2xl font-extrabold text-text">Master Dashboard</h1>

      <SummaryCards />

      <BatchManager
        onChanged={() => {
          mutate();
          mutateBatches();
        }}
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <FilterField label="Batch">
          <Select
            value={batch}
            onChange={(e) => {
              setBatch(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.number} value={b.number}>
                Batch {b.number} ({b.count})
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Editor">
          <Select
            value={editorId}
            onChange={(e) => {
              setEditorId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All editors</option>
            {editors.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Style">
          <Select
            value={styleId}
            onChange={(e) => {
              setStyleId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All styles</option>
            {styles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Status">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FilterField>
      </Card>

      <Card className="divide-y divide-border">
        {items.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">No submissions match these filters.</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium text-text">{item.title}</p>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] text-muted">
                  Batch {item.batchNumber}
                </span>
              </div>
              <p className="mt-0.5 truncate font-mono text-xs text-muted">
                {item.editor?.name ?? "—"} · {item.styleName} ·{" "}
                {formatDuration(item.durationMinutes)}
                {item.clientOrProject ? ` · ${item.clientOrProject}` : ""} ·{" "}
                {formatDate(item.submittedAt)}
              </p>
              {item.notes && (
                <p className="mt-0.5 truncate text-xs italic text-muted-2">
                  &ldquo;{item.notes}&rdquo;
                </p>
              )}
              <a
                href={item.videoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block font-mono text-xs text-accent hover:text-accent-light"
              >
                View video →
              </a>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="mr-1 font-mono text-sm text-text">
                {formatCents(item.calculatedPriceCents)}
              </span>
              <StatusBadge status={item.status} />
              <button
                onClick={() => setEditTarget(item)}
                className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-text"
              >
                Edit
              </button>
              {item.status === "submitted" && (
                <>
                  <Button size="sm" onClick={() => updateStatus(item.id, "approved")}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => updateStatus(item.id, "rejected")}
                  >
                    Reject
                  </Button>
                </>
              )}
              {item.status === "approved" && (
                <>
                  <Button size="sm" onClick={() => updateStatus(item.id, "paid")}>
                    Mark Paid
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => updateStatus(item.id, "rejected")}
                  >
                    Reject
                  </Button>
                </>
              )}
              {item.status === "rejected" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus(item.id, "submitted")}
                >
                  Reconsider
                </Button>
              )}
            </div>
          </div>
        ))}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="font-mono text-xs text-muted disabled:opacity-30 hover:text-text"
          >
            ← Prev
          </button>
          <span className="font-mono text-xs text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="font-mono text-xs text-muted disabled:opacity-30 hover:text-text"
          >
            Next →
          </button>
        </div>
      )}

      <EditSubmissionModal
        key={editTarget?.id ?? "none"}
        submission={editTarget}
        styles={styles}
        onClose={() => setEditTarget(null)}
        onSaved={() => mutate()}
      />
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </div>
  );
}
