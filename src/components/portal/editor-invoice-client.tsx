"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { InvoiceDocument, type InvoiceLineItem } from "@/components/invoice/invoice-document";
import type { Submission } from "@/lib/types";

export function EditorInvoiceClient({ editorName }: { editorName: string }) {
  const { data } = useSWR<{ items: Submission[] }>("/api/submissions?all=true", fetcher);
  const [batch, setBatch] = useState("all");
  const [generated, setGenerated] = useState(false);

  const items = data?.items ?? [];
  const batches = Array.from(new Set(items.map((i) => i.batchNumber))).sort((a, b) => b - a);

  const filtered = batch === "all" ? items : items.filter((i) => i.batchNumber === Number(batch));
  const totalCents = filtered.reduce((sum, i) => sum + i.calculatedPriceCents, 0);

  if (generated) {
    const lineItems: InvoiceLineItem[] = filtered.map((i) => ({
      title: i.title,
      detail: i.styleName + (i.clientOrProject ? ` · ${i.clientOrProject}` : ""),
      durationMinutes: i.durationMinutes,
      amountCents: i.calculatedPriceCents,
    }));
    return (
      <div>
        <div className="mx-auto max-w-3xl px-6 pt-6 print:hidden">
          <button
            onClick={() => setGenerated(false)}
            className="font-mono text-xs uppercase tracking-wider text-muted hover:text-text"
          >
            ← Back
          </button>
        </div>
        <InvoiceDocument
          fromName={editorName}
          toName="AHMD.GPT"
          dateLabel={new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          batchLabel={batch === "all" ? "All submissions" : `Batch ${batch}`}
          items={lineItems}
          totalCents={totalCents}
          footerNote="Generated from AHMD.GPT Editor Ops using standard payout rates."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-text">Generate Invoice</h1>
        <p className="mt-1 text-sm text-muted">
          Uses the standard PKR rates already set for each style. Pick a batch, or all your
          submissions, then generate a printable invoice to send to the owner.
        </p>
      </div>

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-muted">
            Batch
          </label>
          <Select value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="all">All submissions</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                Batch {b}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => setGenerated(true)} disabled={filtered.length === 0}>
          Generate →
        </Button>
      </Card>

      <p className="text-xs text-muted">
        {filtered.length} video{filtered.length === 1 ? "" : "s"} in this selection.
      </p>
    </div>
  );
}
