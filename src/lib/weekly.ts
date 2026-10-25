import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/date";

// Weeks run Monday 00:00 to Monday 00:00 Pakistan time (UTC+5, no DST), since
// that's where the team works. All maths is done on UTC instants.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// What the week's top editor gets, shown in the wrap-up. Leave empty to
// announce the bonus without an amount.
const WEEKLY_BONUS = "PKR 5,000";

export function weekStart(at: Date = new Date()): Date {
  const local = new Date(at.getTime() + PKT_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(localMidnight - daysSinceMonday * DAY_MS - PKT_OFFSET_MS);
}

function formatMinutes(minutes: number) {
  return `${Math.round(minutes * 10) / 10} min`;
}

function videos(count: number) {
  return `${count} video${count === 1 ? "" : "s"}`;
}

/** "5 videos · 34 min" for one editor so far this week. Rejected work doesn't count. */
export async function editorWeekSummary(editorId: string): Promise<string> {
  const totals = await prisma.videoSubmission.aggregate({
    where: { editorId, submittedAt: { gte: weekStart() }, status: { not: "rejected" } },
    _count: true,
    _sum: { durationMinutes: true },
  });
  return `${videos(totals._count)} · ${formatMinutes(totals._sum.durationMinutes ?? 0)}`;
}

/** Wrap-up for the last full week, or null if nobody logged anything. */
export async function lastWeekWrapUp(): Promise<{ weekKey: string; message: string } | null> {
  const end = weekStart();
  const start = new Date(end.getTime() - 7 * DAY_MS);

  const rows = await prisma.videoSubmission.groupBy({
    by: ["editorId"],
    where: { submittedAt: { gte: start, lt: end }, status: { not: "rejected" } },
    _count: true,
    _sum: { durationMinutes: true },
  });
  if (rows.length === 0) return null;

  const editors = await prisma.editor.findMany({
    where: { id: { in: rows.map((r) => r.editorId) } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(editors.map((e) => [e.id, e.name]));

  const ranked = rows
    .map((r) => ({
      name: nameOf.get(r.editorId) ?? "Unknown",
      count: r._count,
      minutes: r._sum.durationMinutes ?? 0,
    }))
    .sort((a, b) => b.count - a.count || b.minutes - a.minutes);

  const top = ranked[0];
  const totalCount = ranked.reduce((n, r) => n + r.count, 0);
  const totalMinutes = ranked.reduce((n, r) => n + r.minutes, 0);
  const lastDay = new Date(end.getTime() - DAY_MS + PKT_OFFSET_MS);

  const message = [
    `📊 **Weekly wrap-up** (${formatDate(new Date(start.getTime() + PKT_OFFSET_MS))} – ${formatDate(lastDay)})`,
    `🏆 Top editor: **${top.name}** with ${videos(top.count)} (${formatMinutes(top.minutes)})`,
    `🎁 ${top.name} gets this week's bonus${WEEKLY_BONUS ? `: **${WEEKLY_BONUS}**` : "!"}`,
    "",
    ...ranked.map((r, i) => `${i + 1}. **${r.name}**: ${videos(r.count)} · ${formatMinutes(r.minutes)}`),
    "",
    `Team total: ${videos(totalCount)} · ${formatMinutes(totalMinutes)}`,
  ].join("\n");

  return { weekKey: start.toISOString(), message };
}
