"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { EyeLogo } from "@/components/eye-logo";
import { AudioCheckBox, type AudioCheck } from "@/components/rules/audio-check";
import { RulesChecklist } from "@/components/rules/rules-checklist";
import { AD_TYPE_LABELS, type AdType } from "@/lib/ad-types";
import type { BriefItem } from "@/lib/briefs-schema";

interface ChecklistData {
  title: string;
  adType: string;
  brief: string;
  editorName: string | null;
  items: BriefItem[];
  checked: string[];
  minLoudnessLufs: number;
}

/**
 * What the editor opens from the link QA sent: the brief, and the checklist to
 * tick while they edit. Ticks save as they go, so QA sees progress live.
 */
export function ChecklistClient({ code }: { code: string }) {
  const { data, error, mutate } = useSWR<ChecklistData>(`/api/checklist/${code}`, fetcher);
  const [audio, setAudio] = useState<AudioCheck>({ status: "idle" });
  const [showBrief, setShowBrief] = useState(true);
  const [saveError, setSaveError] = useState(false);

  async function toggle(itemId: string) {
    if (!data) return;
    const nowChecked = !data.checked.includes(itemId);
    const optimistic = nowChecked
      ? [...data.checked, itemId]
      : data.checked.filter((id) => id !== itemId);
    mutate({ ...data, checked: optimistic }, false);
    const res = await fetch(`/api/checklist/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, checked: nowChecked }),
    }).catch(() => null);
    setSaveError(!res?.ok);
    mutate();
  }

  if (error) {
    return (
      <Shell>
        <Card className="p-6 text-sm text-muted">
          This checklist doesn&rsquo;t exist, or it was deleted. Ask QA for a new link.
        </Card>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell>
        <p className="text-sm text-muted">Loading…</p>
      </Shell>
    );
  }

  const done = data.checked.length;
  const total = data.items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;

  return (
    <Shell>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {AD_TYPE_LABELS[data.adType as AdType] ?? data.adType}
          {data.editorName ? ` · for ${data.editorName}` : ""}
        </p>
        <h1 className="font-display text-2xl font-extrabold text-text">{data.title}</h1>
        <p className="mt-1 text-sm text-muted">
          Read the brief, then tick every point before you send the video to QA. Each one is
          something the client has sent back before.
        </p>
      </div>

      <Card className="sticky top-3 z-10 p-4">
        <div className="flex items-baseline justify-between">
          <span className={`font-mono text-sm ${complete ? "text-green" : "text-text"}`}>
            {complete ? "✓ All done, send it to QA" : `${done} of ${total} ticked`}
          </span>
          <span className="font-mono text-xs text-muted">{pct}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-surface-2">
          <div
            className={`h-2 rounded-full transition-all ${complete ? "bg-green" : "bg-accent"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {saveError && (
          <p className="mt-2 text-xs text-accent">Couldn&rsquo;t save that tick. Check your internet and try again.</p>
        )}
      </Card>

      {data.brief && (
        <Card className="p-5">
          <button
            type="button"
            onClick={() => setShowBrief(!showBrief)}
            className="flex w-full items-center justify-between font-mono text-[11px] uppercase tracking-wider text-muted hover:text-text"
          >
            <span>The brief</span>
            <span>{showBrief ? "Hide ▲" : "Show ▼"}</span>
          </button>
          {showBrief && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text">{data.brief}</p>
          )}
        </Card>
      )}

      <Card className="p-5">
        <RulesChecklist rules={data.items} checked={new Set(data.checked)} onToggle={toggle} />
      </Card>

      <Card className="p-5">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Volume check</p>
        <AudioCheckBox minLufs={data.minLoudnessLufs} value={audio} onChange={setAudio} />
        <p className="mt-2 text-xs text-muted-2">
          Drop your export before sending it. The file stays on your computer.
        </p>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-4 sm:px-6">
          <EyeLogo className="h-6 w-6 text-text" />
          <span className="font-display text-sm font-extrabold tracking-tight text-text">AHMD.GPT</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
