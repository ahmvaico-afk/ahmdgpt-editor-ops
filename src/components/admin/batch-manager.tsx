"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatCents } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { BatchInfo } from "@/lib/types";

export function BatchManager({ onChanged }: { onChanged: () => void }) {
  const { data, mutate } = useSWR<{ currentBatch: number; batches: BatchInfo[] }>(
    "/api/admin/batches",
    fetcher,
    { refreshInterval: 10000 }
  );
  const [wipeTarget, setWipeTarget] = useState<BatchInfo | null>(null);

  async function startNewBatch() {
    if (!data) return;
    await fetch("/api/admin/batches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentBatch: data.currentBatch + 1 }),
    });
    mutate();
    onChanged();
  }

  async function setBatchNumber(value: string) {
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) return;
    await fetch("/api/admin/batches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentBatch: n }),
    });
    mutate();
    onChanged();
  }

  const currentBatch = data?.currentBatch ?? 1;
  const batches = data?.batches ?? [];

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
            Current batch
          </p>
          <p className="font-display text-xl font-bold text-text">Batch {currentBatch}</p>
          <p className="mt-0.5 text-xs text-muted">New videos editors add go here.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted">
              Set batch #
            </p>
            <Input
              type="number"
              min="1"
              defaultValue={currentBatch}
              onBlur={(e) => setBatchNumber(e.target.value)}
              className="!w-24"
            />
          </div>
          <Button variant="outline" onClick={startNewBatch}>
            + Start Batch {currentBatch + 1}
          </Button>
        </div>
      </div>

      {batches.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {batches.map((b) => (
            <div key={b.number} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-text">Batch {b.number}</span>
                {b.number === currentBatch && (
                  <span className="rounded-full border border-green px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-green">
                    current
                  </span>
                )}
                <span className="font-mono text-xs text-muted">
                  {b.count} video{b.count === 1 ? "" : "s"} · {formatCents(b.totalCents)}
                </span>
              </div>
              <button
                onClick={() => setWipeTarget(b)}
                className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
              >
                Wipe batch
              </button>
            </div>
          ))}
        </div>
      )}

      <WipeBatchModal
        batch={wipeTarget}
        onClose={() => setWipeTarget(null)}
        onWiped={() => {
          mutate();
          onChanged();
        }}
      />
    </Card>
  );
}

function WipeBatchModal({
  batch,
  onClose,
  onWiped,
}: {
  batch: BatchInfo | null;
  onClose: () => void;
  onWiped: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);

  const expected = batch ? `DELETE BATCH ${batch.number}` : "";
  const canWipe = confirmText.trim().toUpperCase() === expected;

  async function handleWipe() {
    if (!batch || !canWipe) return;
    setWiping(true);
    try {
      await fetch(`/api/admin/batches/${batch.number}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      setConfirmText("");
      onWiped();
      onClose();
    } finally {
      setWiping(false);
    }
  }

  return (
    <Modal open={batch !== null} onClose={onClose} title="Wipe batch">
      {batch && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text">
            This permanently deletes all <strong>{batch.count}</strong> submission
            {batch.count === 1 ? "" : "s"} in <strong>Batch {batch.number}</strong> (
            {formatCents(batch.totalCents)} total). This cannot be undone.
          </p>
          <div>
            <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted">
              Type <span className="text-accent">{expected}</span> to confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expected}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!canWipe || wiping} onClick={handleWipe}>
              {wiping ? "Wiping…" : "Wipe batch permanently"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
