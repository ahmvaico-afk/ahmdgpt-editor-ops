"use client";

import { useMemo, useState } from "react";
import index from "@/lib/hook/emoji-index.json";

type Entry = { u: string; c: string; n: string; g: number };
const DATA = index as { categories: string[]; quick: string[]; entries: Entry[] };

/** How many to paint at once — the full set is ~1,900 and would jank the sheet. */
const PAGE = 180;

/**
 * Emoji are shown as the bundled artwork rather than as text, so the picker
 * matches what the renderer will actually draw. Picking one inserts the real
 * character into the hook text.
 */
export function EmojiPicker({ onPick }: { onPick: (char: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(0);
  const [limit, setLimit] = useState(PAGE);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return DATA.entries.filter((e) => e.n.includes(q));
    return DATA.entries.filter((e) => e.g === category);
  }, [query, category]);

  const shown = results.slice(0, limit);

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE);
        }}
        placeholder="Search emoji…"
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none placeholder:text-muted-2 focus:border-accent"
      />

      {!query && (
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {DATA.categories.map((name, i) => (
            <button
              key={name}
              onClick={() => {
                setCategory(i);
                setLimit(PAGE);
              }}
              className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                category === i ? "bg-accent text-bg" : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-10">
        {shown.map((e) => (
          <button
            key={e.u}
            title={e.n}
            onClick={() => onPick(e.c)}
            className="flex aspect-square items-center justify-center rounded-md transition-colors hover:bg-surface-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/emoji/${e.u}.png`} alt={e.n} className="h-7 w-7" loading="lazy" />
          </button>
        ))}
        {shown.length === 0 && (
          <p className="col-span-full py-6 text-center text-xs text-muted">
            Nothing matches &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>

      {results.length > shown.length && (
        <button
          onClick={() => setLimit((n) => n + PAGE)}
          className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-text"
        >
          Show more ({results.length - shown.length} left)
        </button>
      )}
    </div>
  );
}

/** The handful that actually turn up in our hooks, for one-tap access. */
export function EmojiQuickRow({ onPick }: { onPick: (char: string) => void }) {
  const quick = DATA.quick
    .map((u) => DATA.entries.find((e) => e.u === u))
    .filter((e): e is Entry => Boolean(e));

  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {quick.map((e) => (
        <button
          key={e.u}
          title={e.n}
          onClick={() => onPick(e.c)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 transition-colors hover:bg-border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/emoji/${e.u}.png`} alt={e.n} className="h-6 w-6" />
        </button>
      ))}
    </div>
  );
}
