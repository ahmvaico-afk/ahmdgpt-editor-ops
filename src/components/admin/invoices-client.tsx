"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import {
  calculateClientPriceCents,
  centsToDollars,
  clientPricingShape,
  clientPricingShapeFields,
  formatUsdCents,
  type ClientPricingShape,
} from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { BatchInfo, Style } from "@/lib/types";

export function InvoicesClient() {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Probe once: a 200 means we already hold a valid unlock cookie from earlier this session.
  useSWR(checked ? null : "/api/admin/invoices/rates", fetcher, {
    onSuccess: () => {
      setUnlocked(true);
      setChecked(true);
    },
    onError: () => setChecked(true),
    shouldRetryOnError: false,
  });

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError(null);
    setUnlocking(true);
    try {
      const res = await fetch("/api/admin/invoices/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setUnlockError(json.error ?? "Could not unlock.");
        return;
      }
      setUnlocked(true);
    } finally {
      setUnlocking(false);
    }
  }

  if (!checked) {
    return <div className="mx-auto w-full max-w-md px-6 py-8" />;
  }

  if (!unlocked) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Invoices — Locked
          </p>
          <h1 className="mt-1 font-display text-xl font-bold text-text">Enter password</h1>
        </div>
        <form onSubmit={handleUnlock} className="flex w-full flex-col gap-3">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Invoice password"
            autoFocus
          />
          {unlockError && <p className="text-xs text-accent">{unlockError}</p>}
          <Button type="submit" disabled={unlocking || !password}>
            {unlocking ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </div>
    );
  }

  return <InvoicesWorkspace />;
}

function InvoicesWorkspace() {
  const { data: ratesData, mutate: mutateRates } = useSWR<{ styles: Style[] }>(
    "/api/admin/invoices/rates",
    fetcher
  );
  const { data: batchesData } = useSWR<{ currentBatch: number; batches: BatchInfo[] }>(
    "/api/admin/batches",
    fetcher
  );

  const [batch, setBatch] = useState("");
  const [clientName, setClientName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");

  const styles = ratesData?.styles ?? [];
  const batches = batchesData?.batches ?? [];

  function openInvoice() {
    if (!batch) return;
    const params = new URLSearchParams();
    if (clientName) params.set("client", clientName);
    if (invoiceNo) params.set("invoiceNo", invoiceNo);
    window.open(`/admin/invoices/${batch}/print?${params.toString()}`, "_blank");
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-text">Invoices</h1>
        <p className="mt-1 text-sm text-muted">
          Client billing rates here are separate from what editors are paid — only visible
          behind this password.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">
          Client billing rates
        </h2>
        <Card className="divide-y divide-border">
          {styles.map((s) => (
            <RateRow key={s.id} style={s} onSaved={mutateRates} />
          ))}
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted">
          Generate invoice
        </h2>
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <div>
            <Label>Batch</Label>
            <Select value={batch} onChange={(e) => setBatch(e.target.value)}>
              <option value="">Choose a batch</option>
              {batches.map((b) => (
                <option key={b.number} value={b.number}>
                  Batch {b.number} ({b.count} videos)
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Client / business name</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div>
            <Label>Invoice #</Label>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </div>
          <Button onClick={openInvoice} disabled={!batch}>
            Generate →
          </Button>
        </Card>
        {batches.length > 0 && batch && (
          <BatchPreview batchNumber={Number(batch)} />
        )}
      </section>
    </div>
  );
}

const SHAPE_OPTIONS: { value: ClientPricingShape; label: string }[] = [
  { value: "per-minute", label: "Per minute — no flat base" },
  { value: "tiered", label: "Flat base, then +$ per 30s (5s grace)" },
  { value: "prorated", label: "Flat base, then +$ per minute, prorated" },
];

/** Durations previewed under each style so a wrong ladder is obvious on sight. */
const PREVIEW_MINUTES = [1, 2, 3, 5];

function RateRow({ style, onSaved }: { style: Style; onSaved: () => void }) {
  const [rate, setRate] = useState(
    style.clientRatePerMinuteCents != null ? String(centsToDollars(style.clientRatePerMinuteCents)) : ""
  );
  const [increment, setIncrement] = useState(String(centsToDollars(style.clientPerMinuteIncrementCents)));
  const [shape, setShape] = useState<ClientPricingShape>(clientPricingShape(style));
  const [baseMinutes, setBaseMinutes] = useState(String((style.clientBaseSeconds || 120) / 60));
  const [saving, setSaving] = useState(false);

  const rateDollars = rate === "" ? null : parseFloat(rate);
  const incrementDollars = parseFloat(increment || "0");
  const baseSeconds = Math.round(parseFloat(baseMinutes || "0") * 60);

  // Always sends the whole client ladder, never a partial patch — an earlier
  // version sent one field at a time and clobbered the others.
  async function save() {
    if (rateDollars !== null && !Number.isFinite(rateDollars)) return;
    if (!Number.isFinite(incrementDollars) || !Number.isFinite(baseSeconds)) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/invoices/rates/${style.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRateDollars: rateDollars,
          clientIncrementDollars: incrementDollars,
          ...clientPricingShapeFields(shape, Math.max(0, baseSeconds)),
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (style.isCustomPricing) {
    return (
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="min-w-[10rem] flex-1 text-sm text-text">{style.name}</span>
        <span className="font-mono text-xs uppercase tracking-wider text-muted-2">
          Custom style — set per invoice manually
        </span>
      </div>
    );
  }

  const previewConfig = {
    clientRatePerMinuteCents: rateDollars === null ? 0 : Math.round(rateDollars * 100),
    clientPerMinuteIncrementCents: Math.round((incrementDollars || 0) * 100),
    ...clientPricingShapeFields(shape, Math.max(0, baseSeconds || 0)),
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-[10rem] flex-1 text-sm text-text">{style.name}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted">$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="not set"
            className="!w-24"
          />
          {shape === "per-minute" ? (
            <span className="text-muted">per minute</span>
          ) : (
            <>
              <span className="text-muted">flat up to</span>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={baseMinutes}
                onChange={(e) => setBaseMinutes(e.target.value)}
                className="!w-16"
              />
              <span className="text-muted">min, then +$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={increment}
                onChange={(e) => setIncrement(e.target.value)}
                className="!w-20"
              />
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={shape}
          onChange={(e) => setShape(e.target.value as ClientPricingShape)}
          className="!w-auto"
        >
          {SHAPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <p className="font-mono text-[11px] text-muted-2">
          {rateDollars === null
            ? "no rate set"
            : PREVIEW_MINUTES.map(
                (m) => `${m}:00 ${formatUsdCents(calculateClientPriceCents(m, previewConfig))}`
              ).join(" · ")}
        </p>
      </div>
    </div>
  );
}

function BatchPreview({ batchNumber }: { batchNumber: number }) {
  const { data } = useSWR<{ totalCents: number; hasMissingRates: boolean; items: unknown[] }>(
    `/api/admin/invoices/batch/${batchNumber}`,
    fetcher
  );
  if (!data) return null;
  return (
    <p className="text-xs text-muted">
      {data.items.length} video{data.items.length === 1 ? "" : "s"} · projected total{" "}
      <span className="text-text">{formatUsdCents(data.totalCents)}</span>
      {data.hasMissingRates && (
        <span className="ml-2 text-warning">
          — some styles in this batch have no client rate set yet
        </span>
      )}
    </p>
  );
}
