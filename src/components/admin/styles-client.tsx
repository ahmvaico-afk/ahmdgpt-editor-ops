"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { centsToDollars } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { Style } from "@/lib/types";

export function StylesClient() {
  const { data, mutate } = useSWR<{ styles: Style[] }>("/api/admin/styles", fetcher, {
    refreshInterval: 10000,
  });
  const styles = data?.styles ?? [];

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newIncrement, setNewIncrement] = useState("");
  const [newCustom, setNewCustom] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createStyle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          isCustomPricing: newCustom,
          ...(newCustom
            ? {}
            : {
                ratePerMinuteDollars: parseFloat(newPrice),
                perMinuteIncrementDollars: newIncrement ? parseFloat(newIncrement) : 0,
              }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not create style.");
        return;
      }
      setNewName("");
      setNewPrice("");
      setNewIncrement("");
      setNewCustom(false);
      mutate();
    } finally {
      setCreating(false);
    }
  }

  async function updateRate(style: Style, dollars: string) {
    const value = parseFloat(dollars);
    if (!Number.isFinite(value)) return;
    await fetch(`/api/admin/styles/${style.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratePerMinuteDollars: value }),
    });
    mutate();
  }

  async function updateIncrement(style: Style, dollars: string) {
    const value = parseFloat(dollars || "0");
    if (!Number.isFinite(value)) return;
    await fetch(`/api/admin/styles/${style.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perMinuteIncrementDollars: value }),
    });
    mutate();
  }

  async function updateName(style: Style, name: string) {
    if (!name.trim() || name === style.name) return;
    await fetch(`/api/admin/styles/${style.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    mutate();
  }

  async function toggleActive(style: Style) {
    await fetch(`/api/admin/styles/${style.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !style.active }),
    });
    mutate();
  }

  async function move(style: Style, direction: -1 | 1) {
    const sorted = [...styles].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((s) => s.id === style.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      fetch(`/api/admin/styles/${style.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swapWith.sortOrder }),
      }),
      fetch(`/api/admin/styles/${swapWith.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: style.sortOrder }),
      }),
    ]);
    mutate();
  }

  const sorted = [...styles].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="font-display text-2xl font-extrabold text-text">Styles &amp; Pricing</h1>

      <Card className="divide-y divide-border">
        {sorted.map((style, idx) => (
          <div key={style.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex flex-col gap-1">
              <button
                disabled={idx === 0}
                onClick={() => move(style, -1)}
                className="text-muted disabled:opacity-20 hover:text-text"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                disabled={idx === sorted.length - 1}
                onClick={() => move(style, 1)}
                className="text-muted disabled:opacity-20 hover:text-text"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>

            <Input
              defaultValue={style.name}
              onBlur={(e) => updateName(style, e.target.value)}
              className="!w-40 flex-1"
            />

            {style.isCustomPricing ? (
              <span className="font-mono text-xs uppercase tracking-wider text-gold">
                Editor sets rate
              </span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted">Rs</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={
                    style.ratePerMinuteCents !== null
                      ? centsToDollars(style.ratePerMinuteCents)
                      : ""
                  }
                  onBlur={(e) => updateRate(style, e.target.value)}
                  className="!w-24"
                />
                <span className="text-muted">min 1, +Rs</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={centsToDollars(style.perMinuteIncrementCents)}
                  onBlur={(e) => updateIncrement(style, e.target.value)}
                  className="!w-20"
                />
                <span className="text-muted">each min after (0 = plain /min rate)</span>
              </div>
            )}

            <button
              onClick={() => toggleActive(style)}
              className={`ml-auto font-mono text-[11px] uppercase tracking-wider ${
                style.active ? "text-green" : "text-muted-2"
              }`}
            >
              {style.active ? "Active" : "Inactive"}
            </button>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">No styles yet.</p>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">
          Add a style
        </h2>
        <form onSubmit={createStyle} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[10rem]">
            <Label>Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          {!newCustom && (
            <>
              <div className="w-32">
                <Label>Rate (Rs/min)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  required={!newCustom}
                />
              </div>
              <div className="w-40">
                <Label>+Rs each min after 1st (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newIncrement}
                  onChange={(e) => setNewIncrement(e.target.value)}
                  placeholder="0"
                />
              </div>
            </>
          )}
          <label className="flex items-center gap-2 pb-2.5 font-mono text-[11px] uppercase tracking-wider text-muted">
            <input
              type="checkbox"
              checked={newCustom}
              onChange={(e) => setNewCustom(e.target.checked)}
            />
            Custom pricing
          </label>
          <Button type="submit" disabled={creating}>
            {creating ? "Adding…" : "Add style"}
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-accent">{error}</p>}
      </Card>
    </div>
  );
}
