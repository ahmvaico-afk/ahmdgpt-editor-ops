const STATUS_STYLES: Record<string, string> = {
  submitted: "text-muted border-muted-2",
  approved: "text-gold border-gold",
  paid: "text-green border-green",
  rejected: "text-accent border-accent",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.submitted;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${cls}`}
    >
      {status}
    </span>
  );
}
