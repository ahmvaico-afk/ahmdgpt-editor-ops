"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatDate } from "@/lib/date";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { AdTypePicker } from "@/components/rules/ad-type-picker";
import { groupRules } from "@/components/rules/rules-checklist";
import { AD_TYPE_LABELS, type AdType } from "@/lib/ad-types";
import { BRIEF_CATEGORY, type BriefItem } from "@/lib/briefs-schema";

interface BriefRow {
  id: string;
  code: string;
  title: string;
  adType: string;
  editorName: string | null;
  createdBy: string | null;
  createdAt: string;
  done: number;
  total: number;
}

function shareLink(code: string) {
  return `${window.location.origin}/checklist/${code}`;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * QA pastes the concept brief, picks the ad type, gets a checklist (the
 * brief's own checks plus the client's standing rules), trims it, and sends
 * the editor one link.
 */
export function BriefsClient() {
  const { data, mutate } = useSWR<{ briefs: BriefRow[]; editors: { id: string; name: string }[] }>(
    "/api/admin/briefs",
    fetcher,
    { refreshInterval: 15000 }
  );

  const [title, setTitle] = useState("");
  const [editorId, setEditorId] = useState("");
  const [adType, setAdType] = useState<AdType | null>(null);
  const [brief, setBrief] = useState("");
  const [items, setItems] = useState<BriefItem[] | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [newLine, setNewLine] = useState("");
  const [busy, setBusy] = useState<"draft" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ code: string; title: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setError(null);
    if (!adType) {
      setError("Pick AI UGC ad or B-roll video first.");
      return;
    }
    setBusy("draft");
    try {
      const res = await fetch("/api/admin/briefs/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adType, brief }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not build the checklist.");
        return;
      }
      setItems(json.items);
      setAiNote(json.aiNote);
    } finally {
      setBusy(null);
    }
  }

  function addLine() {
    if (!newLine.trim() || !items) return;
    setItems([
      { id: randomId(), category: BRIEF_CATEGORY, text: newLine.trim(), detail: null, from: "manual" },
      ...items,
    ]);
    setNewLine("");
  }

  async function save() {
    setError(null);
    if (!items || !adType) return;
    setBusy("save");
    try {
      const res = await fetch("/api/admin/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, adType, brief, editorId, items }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not save the checklist.");
        return;
      }
      setSent({ code: json.code, title });
      setTitle("");
      setBrief("");
      setItems(null);
      setAiNote(null);
      setAdType(null);
      setEditorId("");
      mutate();
    } finally {
      setBusy(null);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(shareLink(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      prompt("Copy this link:", shareLink(code));
    }
  }

  function whatsapp(code: string, videoTitle: string) {
    const text = `Checklist for "${videoTitle}" — read the brief and tick every point before you send it to QA:\n${shareLink(code)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function remove(row: BriefRow) {
    if (!confirm(`Delete the checklist for "${row.title}"? The link will stop working.`)) return;
    await fetch(`/api/admin/briefs/${row.id}`, { method: "DELETE" });
    mutate();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-text">Brief Checklists</h1>
        <p className="mt-1 text-sm text-muted">
          When you assign a video, paste its concept brief here. You get a checklist made from the
          brief plus the client&rsquo;s standing rules. Send the editor the link and they tick it
          off while they edit.
        </p>
      </div>

      {sent && (
        <Card className="flex flex-col gap-3 border-green/40 p-5">
          <p className="text-sm text-text">
            ✓ Checklist for <span className="font-medium">{sent.title}</span> is ready. Send this
            link to the editor:
          </p>
          <code className="break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-xs text-muted">
            {shareLink(sent.code)}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => copy(sent.code)}>
              {copied === sent.code ? "Copied ✓" : "Copy link"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => whatsapp(sent.code, sent.title)}>
              Send on WhatsApp
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSent(null)}>
              Make another
            </Button>
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Video name</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Xanth 1.18 · Hashimoto's husband"
            />
          </div>
          <div>
            <Label>Editor (optional)</Label>
            <Select value={editorId} onChange={(e) => setEditorId(e.target.value)}>
              <option value="">Not assigned yet</option>
              {(data?.editors ?? []).map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>What kind of video</Label>
          <AdTypePicker value={adType} onChange={setAdType} />
        </div>

        <div>
          <Label>Concept brief</Label>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={8}
            placeholder="Paste the whole brief doc here: script, who's in it, who it targets, product shots, notes…"
          />
        </div>

        {error && <p className="text-xs text-accent">{error}</p>}

        <Button type="button" onClick={generate} disabled={busy !== null} className="self-start">
          {busy === "draft" ? "Reading the brief…" : items ? "Rebuild checklist" : "Build checklist"}
        </Button>
      </Card>

      {items && (
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <p className="font-display text-sm font-bold text-text">
              Checklist · {items.length} points · {adType ? AD_TYPE_LABELS[adType] : ""}
            </p>
            <p className="text-xs text-muted">
              Remove anything that doesn&rsquo;t fit this video and add anything missing, then send it.
            </p>
            {aiNote && <p className="mt-2 text-xs text-warning">{aiNote}</p>}
          </div>

          <div className="flex gap-2">
            <Input
              value={newLine}
              onChange={(e) => setNewLine(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLine();
                }
              }}
              placeholder="Add a point for this video, e.g. The husband wears the same blue shirt in every shot."
            />
            <Button type="button" variant="outline" onClick={addLine}>
              Add
            </Button>
          </div>

          {groupRules(items).map(([category, list]) => (
              <div key={category}>
                <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-gold">{category}</p>
                <ul className="flex flex-col gap-1.5">
                  {list.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
                    >
                      <span className="flex-1">
                        <span className="text-sm text-text">{item.text}</span>
                        {item.detail && <span className="mt-0.5 block text-xs text-muted">{item.detail}</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((i) => i.id !== item.id))}
                        className="text-muted transition-colors hover:text-accent"
                        aria-label="Remove this point"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
          ))}

          <Button type="button" onClick={save} disabled={busy !== null || items.length === 0} className="self-start">
            {busy === "save" ? "Saving…" : "Save & get link"}
          </Button>
        </Card>
      )}

      <Card className="divide-y divide-border">
        <p className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-muted">Sent checklists</p>
        {(data?.briefs ?? []).length === 0 && (
          <p className="px-5 py-4 text-sm text-muted">None yet.</p>
        )}
        {(data?.briefs ?? []).map((row) => {
          const complete = row.total > 0 && row.done === row.total;
          return (
            <div key={row.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{row.title}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-muted">
                  {row.editorName ?? "No editor"} ·{" "}
                  {AD_TYPE_LABELS[row.adType as AdType] ?? row.adType} · {formatDate(row.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${
                    complete ? "bg-green/10 text-green" : "bg-surface-2 text-muted"
                  }`}
                >
                  {complete ? "✓ " : ""}
                  {row.done}/{row.total} ticked
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => copy(row.code)}>
                  {copied === row.code ? "Copied ✓" : "Copy link"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => whatsapp(row.code, row.title)}>
                  WhatsApp
                </Button>
                <a
                  href={`/checklist/${row.code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-text"
                >
                  Open
                </a>
                <button
                  type="button"
                  onClick={() => remove(row)}
                  className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-accent"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
