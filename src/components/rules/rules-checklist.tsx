"use client";

/** Anything that can sit on a checklist: a client rule or a brief item. */
export interface ChecklistLine {
  id: string;
  category: string;
  text: string;
  detail?: string | null;
  source?: string | null;
}

/** Items grouped under their category, keeping the order they came in. */
export function groupRules<T extends { category: string }>(rules: T[]) {
  const groups = new Map<string, T[]>();
  for (const rule of rules) {
    const list = groups.get(rule.category) ?? [];
    list.push(rule);
    groups.set(rule.category, list);
  }
  return [...groups.entries()];
}

/**
 * The client's rules as tick boxes. With no `checked`, it's a read-only list
 * for editors to keep open while they work.
 */
export function RulesChecklist({
  rules,
  checked,
  onToggle,
}: {
  rules: ChecklistLine[];
  checked?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const interactive = Boolean(checked && onToggle);

  return (
    <div className="flex flex-col gap-4">
      {groupRules(rules).map(([category, list]) => (
        <div key={category}>
          <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-gold">{category}</p>
          <ul className="flex flex-col gap-1.5">
            {list.map((rule) => {
              const isChecked = checked?.has(rule.id) ?? false;
              const body = (
                <>
                  <span className="text-sm text-text">{rule.text}</span>
                  {rule.detail && (
                    <span className="mt-0.5 block text-xs text-muted">{rule.detail}</span>
                  )}
                </>
              );
              return (
                <li key={rule.id}>
                  {interactive ? (
                    <label
                      className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        isChecked ? "border-green/40 bg-green/5" : "border-border bg-surface-2 hover:border-muted-2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggle?.(rule.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-green)]"
                      />
                      <span>{body}</span>
                    </label>
                  ) : (
                    <div className="flex gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                      <span className="mt-0.5 shrink-0 text-muted">☐</span>
                      <span>
                        {body}
                        {rule.source && (
                          <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-muted-2">
                            {rule.source}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
