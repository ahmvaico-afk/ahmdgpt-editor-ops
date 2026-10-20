"use client";

import { AD_TYPES, AD_TYPE_LABELS, type AdType } from "@/lib/ad-types";

const HINTS: Record<AdType, string> = {
  ugc: "AI actor talking to camera",
  broll: "Story told over B-roll clips",
};

/** Two big buttons: which checklist applies to this video. */
export function AdTypePicker({
  value,
  onChange,
}: {
  value: AdType | null;
  onChange: (next: AdType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AD_TYPES.map((type) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
              active
                ? "border-accent bg-accent/10 text-text"
                : "border-border bg-surface-2 text-muted hover:text-text"
            }`}
          >
            <span className="block text-sm font-medium">{AD_TYPE_LABELS[type]}</span>
            <span className="block text-[11px] text-muted">{HINTS[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
