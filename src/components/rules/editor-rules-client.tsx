"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { AudioCheckBox, type AudioCheck } from "@/components/rules/audio-check";
import { RulesChecklist } from "@/components/rules/rules-checklist";
import { AdTypePicker } from "@/components/rules/ad-type-picker";
import { AD_TYPE_LABELS, ruleAppliesTo, type AdType } from "@/lib/ad-types";
import type { ClientRule } from "@/lib/types";

/** The rulebook, for editors to keep open while they cut. */
export function EditorRulesClient() {
  const { data } = useSWR<{ rules: ClientRule[]; minLoudnessLufs: number }>(
    "/api/rules",
    fetcher,
    { refreshInterval: 30000 }
  );
  const [audio, setAudio] = useState<AudioCheck>({ status: "idle" });
  const [adType, setAdType] = useState<AdType>("ugc");
  const rules = (data?.rules ?? []).filter((r) => ruleAppliesTo(r, adType));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">Don&rsquo;t get it sent back</p>
        <h1 className="font-display text-2xl font-extrabold text-text">Client Rules</h1>
        <p className="mt-1 text-sm text-muted">
          Everything the client has sent back before. Read it before you start, check it before you
          export. You&rsquo;ll tick every one when you add the video.
        </p>
      </div>

      <Card className="p-5">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">Volume check</p>
        <AudioCheckBox minLufs={data?.minLoudnessLufs ?? -12} value={audio} onChange={setAudio} />
        <p className="mt-2 text-xs text-muted-2">
          The file stays on your computer. Nothing is uploaded.
        </p>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <AdTypePicker value={adType} onChange={setAdType} />
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
          {AD_TYPE_LABELS[adType]} checklist · {rules.length} rules
        </p>
        {data ? (
          rules.length > 0 ? (
            <RulesChecklist rules={rules} />
          ) : (
            <p className="text-sm text-muted">No rules yet.</p>
          )
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </Card>
    </div>
  );
}
