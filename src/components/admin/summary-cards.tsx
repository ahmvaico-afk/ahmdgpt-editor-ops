import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { formatCents } from "@/lib/pricing";
import { Card } from "@/components/ui/card";
import type { AdminSummary } from "@/lib/types";

export function SummaryCards() {
  const { data } = useSWR<AdminSummary>("/api/admin/summary", fetcher, {
    refreshInterval: 8000,
  });

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">This week</p>
        <p className="mt-1 font-display text-xl font-bold text-text">
          {data?.videosThisWeek ?? "—"} videos
        </p>
      </Card>
      <Card className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">This month</p>
        <p className="mt-1 font-display text-xl font-bold text-text">
          {data?.videosThisMonth ?? "—"} videos
        </p>
      </Card>
      <Card className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Owed</p>
        <p className="mt-1 font-display text-xl font-bold text-warning">
          {formatCents(data?.owed.totalCents ?? 0)}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-muted">{data?.owed.count ?? 0} pending</p>
      </Card>
      <Card className="p-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Paid out</p>
        <p className="mt-1 font-display text-xl font-bold text-green">
          {formatCents(data?.paidOut.totalCents ?? 0)}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-muted">{data?.paidOut.count ?? 0} paid</p>
      </Card>
    </div>
  );
}
