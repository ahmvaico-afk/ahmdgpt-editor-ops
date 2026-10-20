"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { RULE_SCOPES, RULE_SCOPE_LABELS, type RuleScope } from "@/lib/ad-types";
import { groupRules } from "@/components/rules/rules-checklist";
import type { ClientRule } from "@/lib/types";

const SUGGESTED_GROUPS = [
  "Story & casting",
  "B-roll",
  "Pacing",
  "Realism",
  "Performance",
  "Audio",
  "Text & captions",
  "Before you submit",
];

/**
 * Where a new revision note becomes a rule. Every active rule shows up in the
 * editors' checklist straight away — they have to tick it to submit.
 */
export function RulesAdminClient() {
  const { data, mutate } = useSWR<{ rules: ClientRule[]; minLoudnessLufs: number }>(
    "/api/admin/rules",
    fetcher
  );
  const rules = data?.rules ?? [];
  const groups = groupRules(rules);
  const groupNames = [...new Set([...groups.map(([g]) => g), ...SUGGESTED_GROUPS])];

  const [category, setCategory] = useState(SUGGESTED_GROUPS[0]);
  const [text, setText] = useState("");
  const [detail, setDetail] = useState("");
  const [source, setSource] = useState("");
  const [appliesTo, setAppliesTo] = useState<RuleScope>("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, text, detail, source, appliesTo }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not add the rule.");
        return;
      }
      setText("");
      setDetail("");
      mutate();
    } finally {
      setSaving(false);
    }
  }

  async function patch(rule: ClientRule, update: Partial<ClientRule>) {
    await fetch(`/api/admin/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    mutate();
  }

  async function remove(rule: ClientRule) {
    if (!confirm(`Delete this rule for good?\n\n"${rule.text}"\n\n(Turning it off keeps it, just hidden.)`)) return;
    await fetch(`/api/admin/rules/${rule.id}`, { method: "DELETE" });
    mutate();
  }

  async function saveLoudness(value: string) {
    const n = parseFloat(value);
    if (!Number.isFinite(n) || n === data?.minLoudnessLufs) return;
    await fetch("/api/admin/rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minLoudnessLufs: n }),
    });
    mutate();
  }

  const activeCount = rules.filter((r) => r.active).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-text">Client Rules</h1>
        <p className="mt-1 text-sm text-muted">
          {activeCount} rule{activeCount === 1 ? "" : "s"} live. Editors pick AI UGC ad or B-roll video
          when they submit, and have to tick every live rule for that kind of ad. When the client sends a revision, add it here once and
          nobody makes that mistake again.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={addRule} className="flex flex-col gap-3">
          <p className="font-display text-sm font-bold text-text">Add a rule</p>
          <div>
            <Label>Group</Label>
            <Input
              list="rule-groups"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
            <datalist id="rule-groups">
              {groupNames.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div>
            <Label>The check (write it so &ldquo;yes&rdquo; means the video is fine)</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Hook text is on screen in the first second."
              required
            />
          </div>
          <div>
            <Label>Which checklist</Label>
            <Select value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as RuleScope)}>
              {RULE_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {RULE_SCOPE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Why / how (optional)</Label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={2}
              placeholder="What the client said, or an example of what not to do"
            />
          </div>
          <div>
            <Label>From (optional)</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Xanth · ad 1.18 · 21 Oct"
            />
          </div>
          {error && <p className="text-xs text-accent">{error}</p>}
          <Button type="submit" disabled={saving} className="self-start">
            {saving ? "Adding…" : "Add rule"}
          </Button>
        </form>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-display text-sm font-bold text-text">Volume bar</p>
          <p className="text-xs text-muted">
            Quietest an export can be and still be submitted. Closer to 0 is louder (-9 loud, -14
            normal, -20 quiet).
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <Input
              key={data.minLoudnessLufs}
              type="number"
              step="0.5"
              min="-40"
              max="0"
              defaultValue={data.minLoudnessLufs}
              onBlur={(e) => saveLoudness(e.target.value)}
              className="w-24 text-center"
            />
            <span className="font-mono text-xs text-muted">LUFS</span>
          </div>
        )}
      </Card>

      {groups.map(([group, list]) => (
        <Card key={group} className="divide-y divide-border">
          <p className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-gold">{group}</p>
          {list.map((rule) => (
            <div key={rule.id} className={`flex flex-col gap-2 p-4 ${rule.active ? "" : "opacity-45"}`}>
              <Input
                defaultValue={rule.text}
                onBlur={(e) => e.target.value.trim() && e.target.value !== rule.text && patch(rule, { text: e.target.value })}
              />
              <Textarea
                defaultValue={rule.detail ?? ""}
                rows={2}
                placeholder="Why / how"
                onBlur={(e) => e.target.value !== (rule.detail ?? "") && patch(rule, { detail: e.target.value })}
                className="text-xs"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                  {rule.source ?? "—"}
                </span>
                <div className="flex items-center gap-2">
                  <Select
                    value={rule.appliesTo}
                    onChange={(e) => patch(rule, { appliesTo: e.target.value })}
                    className="!w-auto !py-1.5 text-xs"
                    aria-label="Which checklist"
                  >
                    {RULE_SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {RULE_SCOPE_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => patch(rule, { active: !rule.active })}
                  >
                    {rule.active ? "Turn off" : "Turn on"}
                  </Button>
                  <Button type="button" size="sm" variant="danger" onClick={() => remove(rule)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
