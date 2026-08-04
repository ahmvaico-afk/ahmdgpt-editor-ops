import { prisma } from "@/lib/prisma";

// Asia/Karachi is UTC+5 year-round (no DST) — fixed offset, no timezone lib needed.
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;

function toKarachi(date: Date): Date {
  return new Date(date.getTime() + KARACHI_OFFSET_MS);
}

function karachiDateKey(date: Date): string {
  const k = toKarachi(date);
  return `${k.getUTCFullYear()}-${k.getUTCMonth()}-${k.getUTCDate()}`;
}

/** Most recent Monday 00:00 Karachi time, as a real UTC instant for DB queries. */
export function getWeekStart(now = new Date()): Date {
  const k = toKarachi(now);
  const day = k.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? 6 : day - 1;
  const karachiMidnight = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - diffToMonday);
  return new Date(karachiMidnight - KARACHI_OFFSET_MS);
}

export interface LeaderboardRow {
  editorId: string;
  name: string;
  videoCount: number;
  activeDays: number;
  score: number;
}

export interface LeaderboardResult {
  weekStart: string;
  weekEnd: string;
  rows: LeaderboardRow[];
}

/**
 * Score rewards both volume and showing up daily: 10pts/video + 15pts per
 * distinct day with at least one submission (max 7). Rejected submissions
 * don't count — they weren't real completed work.
 */
export async function getWeeklyLeaderboard(): Promise<LeaderboardResult> {
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const editors = await prisma.editor.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const submissions = await prisma.videoSubmission.findMany({
    where: { submittedAt: { gte: weekStart, lt: weekEnd }, status: { not: "rejected" } },
    select: { editorId: true, submittedAt: true },
  });

  const byEditor = new Map<string, { count: number; days: Set<string> }>();
  for (const s of submissions) {
    const entry = byEditor.get(s.editorId) ?? { count: 0, days: new Set<string>() };
    entry.count += 1;
    entry.days.add(karachiDateKey(s.submittedAt));
    byEditor.set(s.editorId, entry);
  }

  const rows: LeaderboardRow[] = editors.map((e) => {
    const entry = byEditor.get(e.id);
    const videoCount = entry?.count ?? 0;
    const activeDays = entry?.days.size ?? 0;
    return {
      editorId: e.id,
      name: e.name,
      videoCount,
      activeDays,
      score: videoCount * 10 + activeDays * 15,
    };
  });

  rows.sort((a, b) => b.score - a.score || b.videoCount - a.videoCount);

  return { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), rows };
}
