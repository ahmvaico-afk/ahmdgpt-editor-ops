"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { Card } from "@/components/ui/card";
import { AD_TYPE_LABELS, type AdType } from "@/lib/ad-types";

interface MyBrief {
  code: string;
  title: string;
  adType: string;
  done: number;
  total: number;
}

/**
 * Checklists QA assigned to this editor, so the link isn't lost in WhatsApp.
 * Hidden until there's at least one unfinished.
 */
export function MyChecklists() {
  const { data } = useSWR<{ briefs: MyBrief[] }>("/api/briefs", fetcher, { refreshInterval: 30000 });
  const open = (data?.briefs ?? []).filter((b) => b.done < b.total);
  if (open.length === 0) return null;

  return (
    <Card className="divide-y divide-border border-accent/30">
      <p className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-accent">
        Your checklists · tick these before sending to QA
      </p>
      {open.map((b) => (
        <Link
          key={b.code}
          href={`/checklist/${b.code}`}
          className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-white/5"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm text-text">{b.title}</span>
            <span className="font-mono text-[11px] text-muted">
              {AD_TYPE_LABELS[b.adType as AdType] ?? b.adType}
            </span>
          </span>
          <span className="shrink-0 font-mono text-xs text-muted">
            {b.done}/{b.total} →
          </span>
        </Link>
      ))}
    </Card>
  );
}
