export function SystemLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
      <span className="status-dot" />
      {children}
    </span>
  );
}
