"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date";

interface Applicant {
  id: string;
  name: string;
  whatsapp: string;
  city: string | null;
  hasAiAdsExperience: boolean;
  portfolio: string | null;
  software: string;
  aiTools: string | null;
  ownsComputer: boolean;
  computerSpecs: string | null;
  ownsPhone: boolean;
  hoursPerDay: string;
  handlesFeedback: boolean;
  turnaround: string | null;
  expectedPayPkr: string | null;
  whyYou: string | null;
  attentionPassed: boolean;
  status: "new" | "shortlisted" | "rejected";
  createdAt: string;
}

const HOURS_LABELS: Record<string, string> = {
  under5: "Under 5h/day",
  "5to8": "5–8h/day",
  "8to10": "8–10h/day",
  "10plus": "10+h/day",
};

const TABS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "rejected", label: "Rejected" },
] as const;

export function ApplicantsClient() {
  const [tab, setTab] = useState("new");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, mutate } = useSWR<{
    applicants: Applicant[];
    counts: Record<string, number>;
  }>(`/api/admin/applicants${tab ? `?status=${tab}` : ""}`, fetcher, {
    refreshInterval: 30000,
  });

  const applicants = data?.applicants ?? [];

  async function setStatus(id: string, status: Applicant["status"]) {
    setBusy(id);
    try {
      await fetch("/api/admin/applicants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await mutate();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                tab === t.value ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              {t.label}
              {data?.counts?.[t.value] != null && ` (${data.counts[t.value]})`}
            </button>
          ))}
        </div>
        <a
          href="/apply"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] uppercase tracking-wider text-accent hover:text-accent-light"
        >
          Open the form →
        </a>
      </div>

      <Card className="divide-y divide-border">
        {applicants.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">Nothing here yet.</p>
        )}
        {applicants.map((p) => {
          const expanded = open === p.id;
          return (
            <div key={p.id} className="flex flex-col">
              <button
                onClick={() => setOpen(expanded ? null : p.id)}
                className="flex flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                    {p.name}
                    {!p.attentionPassed && (
                      <span className="rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                        failed check
                      </span>
                    )}
                    {p.hasAiAdsExperience && (
                      <span className="rounded-full bg-green/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-green">
                        AI ads
                      </span>
                    )}
                    {!p.ownsComputer && (
                      <span className="rounded-full bg-warning/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-warning">
                        no PC
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {p.whatsapp}
                    {p.city ? ` · ${p.city}` : ""} · {HOURS_LABELS[p.hoursPerDay] ?? p.hoursPerDay}{" "}
                    · {formatDate(p.createdAt)}
                  </p>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-2">
                  {expanded ? "▲" : "▼"}
                </span>
              </button>

              {expanded && (
                <div className="flex flex-col gap-3 border-t border-border bg-surface-2/40 p-4">
                  <Row label="Software">{p.software}</Row>
                  {p.aiTools && <Row label="AI tools">{p.aiTools}</Row>}
                  {p.portfolio && (
                    <Row label="Work">
                      <span className="break-all">{p.portfolio}</span>
                    </Row>
                  )}
                  <Row label="Computer">
                    {p.ownsComputer ? p.computerSpecs || "Yes" : "None"}
                  </Row>
                  <Row label="Phone">{p.ownsPhone ? "Yes" : "No"}</Row>
                  <Row label="Feedback">{p.handlesFeedback ? "Says yes" : "Says no"}</Row>
                  {p.turnaround && <Row label="Turnaround">{p.turnaround}</Row>}
                  {p.expectedPayPkr && <Row label="Expects">{p.expectedPayPkr}</Row>}
                  {p.whyYou && (
                    <Row label="Why them">
                      <span className="whitespace-pre-wrap">{p.whyYou}</span>
                    </Row>
                  )}

                  <div className="mt-1 flex flex-wrap gap-2">
                    <a
                      href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-green/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-green transition-colors hover:bg-green/25"
                    >
                      WhatsApp
                    </a>
                    {p.status !== "shortlisted" && (
                      <Button
                        size="sm"
                        disabled={busy === p.id}
                        onClick={() => setStatus(p.id, "shortlisted")}
                      >
                        Shortlist
                      </Button>
                    )}
                    {p.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy === p.id}
                        onClick={() => setStatus(p.id, "rejected")}
                      >
                        Reject
                      </Button>
                    )}
                    {p.status !== "new" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === p.id}
                        onClick={() => setStatus(p.id, "new")}
                      >
                        Back to new
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </span>
      <span className="text-sm text-text">{children}</span>
    </div>
  );
}
