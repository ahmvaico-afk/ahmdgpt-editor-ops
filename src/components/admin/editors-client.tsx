"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import type { AdminEditor } from "@/lib/types";

export function EditorsClient() {
  const { data, mutate } = useSWR<{ editors: AdminEditor[] }>("/api/admin/editors", fetcher, {
    refreshInterval: 10000,
  });
  const editors = data?.editors ?? [];

  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; editorCode: string; pin: string } | null>(
    null
  );
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState("");

  async function createEditor(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/admin/editors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not create editor.");
        return;
      }
      setCreated({ name, editorCode: json.editor.editorCode, pin });
      setName("");
      setPin("");
      mutate();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(editor: AdminEditor) {
    await fetch(`/api/admin/editors/${editor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !editor.active }),
    });
    mutate();
  }

  async function toggleQa(editor: AdminEditor) {
    const next = !editor.isQa;
    const message = next
      ? `Make ${editor.name} QA? They'll be able to log revisions, approve videos and sign off logged time for everyone except themselves.`
      : `Remove QA from ${editor.name}?`;
    if (!confirm(message)) return;
    await fetch(`/api/admin/editors/${editor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isQa: next }),
    });
    mutate();
  }

  async function deleteEditor(editor: AdminEditor) {
    const submissionNote =
      editor._count.submissions > 0
        ? ` This also permanently deletes their ${editor._count.submissions} submission(s).`
        : "";
    if (
      !confirm(`Delete ${editor.name} (${editor.editorCode})?${submissionNote} This can't be undone.`)
    ) {
      return;
    }
    await fetch(`/api/admin/editors/${editor.id}`, { method: "DELETE" });
    mutate();
  }

  async function submitResetPin(editorId: string) {
    if (resetPin.length < 4) return;
    await fetch(`/api/admin/editors/${editorId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: resetPin }),
    });
    setResetTarget(null);
    setResetPin("");
    mutate();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <h1 className="font-display text-2xl font-extrabold text-text">Editors</h1>

      <Card className="divide-y divide-border">
        {editors.map((editor) => (
          <div key={editor.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">{editor.name}</p>
              <p className="font-mono text-xs text-muted">
                Code: {editor.editorCode} · {editor._count.submissions} submissions
              </p>
            </div>

            {resetTarget === editor.id ? (
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetPin}
                  onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="New PIN"
                  className="!w-24"
                  autoFocus
                />
                <Button size="sm" onClick={() => submitResetPin(editor.id)}>
                  Save
                </Button>
                <button
                  onClick={() => {
                    setResetTarget(null);
                    setResetPin("");
                  }}
                  className="font-mono text-[11px] text-muted hover:text-text"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setResetTarget(editor.id)}
                className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-text"
              >
                Reset PIN
              </button>
            )}

            <button
              onClick={() => toggleQa(editor)}
              title={editor.isQa ? "Remove QA" : "Make QA"}
              className={`rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                editor.isQa
                  ? "bg-gold/15 text-gold"
                  : "text-muted-2 hover:text-muted"
              }`}
            >
              {editor.isQa ? "QA" : "Make QA"}
            </button>

            <button
              onClick={() => toggleActive(editor)}
              className={`font-mono text-[11px] uppercase tracking-wider ${
                editor.active ? "text-green" : "text-muted-2"
              }`}
            >
              {editor.active ? "Active" : "Inactive"}
            </button>

            <button
              onClick={() => deleteEditor(editor)}
              aria-label="Delete editor"
              className="text-muted transition-colors hover:text-accent"
            >
              Delete
            </button>
          </div>
        ))}
        {editors.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">No editors yet.</p>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">
          Add an editor
        </h2>
        <form onSubmit={createEditor} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[10rem]">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="w-32">
            <Label>Initial PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? "Adding…" : "Add editor"}
          </Button>
        </form>
        {error && <p className="mt-2 text-xs text-accent">{error}</p>}
        {created && (
          <p className="mt-3 rounded-lg border border-border bg-surface-2 p-3 font-mono text-xs text-green">
            {created.name}&rsquo;s login code is <strong>{created.editorCode}</strong> — share it
            with them along with the PIN they&rsquo;ll log in with at /portal/
            {created.editorCode}.
          </p>
        )}
      </Card>
    </div>
  );
}
