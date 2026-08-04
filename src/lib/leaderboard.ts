import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// Asia/Karachi is UTC+5 year-round (no DST) — fixed offset, no timezone lib needed.
const KARACHI_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_LOOKBACK_DAYS = 120;

export const BATCH_BONUS_CENTS = 500000; // Rs 5,000
export const MONTHLY_BONUS_CENTS = 500000; // Rs 5,000

function toKarachi(date: Date): Date {
  return new Date(date.getTime() + KARACHI_OFFSET_MS);
}

function karachiDateKey(date: Date): string {
  const k = toKarachi(date);
  return `${k.getUTCFullYear()}-${k.getUTCMonth()}-${k.getUTCDate()}`;
}

/** Start of today, 00:00 Karachi time, as a real UTC instant for DB queries. */
function karachiTodayStart(now = new Date()): Date {
  const k = toKarachi(now);
  const utcMidnight = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
  return new Date(utcMidnight - KARACHI_OFFSET_MS);
}

/** 1st of the current month, 00:00 Karachi time, as a real UTC instant. */
export function getMonthStart(now = new Date()): Date {
  const k = toKarachi(now);
  const karachiMidnight = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1);
  return new Date(karachiMidnight - KARACHI_OFFSET_MS);
}

export function getMonthEnd(now = new Date()): Date {
  const k = toKarachi(now);
  const karachiMidnight = Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 1);
  return new Date(karachiMidnight - KARACHI_OFFSET_MS);
}

/** Consecutive days (ending today or yesterday, so today's "not yet submitted" doesn't break it). */
function computeStreak(days: Set<string>, now = new Date()): number {
  let cursor = karachiTodayStart(now);
  if (!days.has(karachiDateKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  let streak = 0;
  while (days.has(karachiDateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export interface LeaderboardRow {
  editorId: string;
  name: string;
  videoCount: number;
  activeDays: number;
  score: number;
  streak: number;
}

export interface LeaderboardResult {
  rows: LeaderboardRow[];
}

async function getStreakMap(): Promise<Map<string, number>> {
  const lookbackStart = new Date(karachiTodayStart().getTime() - STREAK_LOOKBACK_DAYS * DAY_MS);
  const submissions = await prisma.videoSubmission.findMany({
    where: { submittedAt: { gte: lookbackStart }, status: { not: "rejected" } },
    select: { editorId: true, submittedAt: true },
  });

  const byEditor = new Map<string, Set<string>>();
  for (const s of submissions) {
    const set = byEditor.get(s.editorId) ?? new Set<string>();
    set.add(karachiDateKey(s.submittedAt));
    byEditor.set(s.editorId, set);
  }

  const streaks = new Map<string, number>();
  for (const [editorId, days] of byEditor) {
    streaks.set(editorId, computeStreak(days));
  }
  return streaks;
}

/**
 * Score rewards both volume and showing up daily: 10pts/video + 15pts per
 * distinct day with at least one submission. Rejected submissions don't
 * count — they weren't real completed work.
 */
async function computeLeaderboardRows(
  where: Prisma.VideoSubmissionWhereInput
): Promise<LeaderboardRow[]> {
  const editors = await prisma.editor.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const submissions = await prisma.videoSubmission.findMany({
    where: { ...where, status: { not: "rejected" } },
    select: { editorId: true, submittedAt: true },
  });
  const streaks = await getStreakMap();

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
      streak: streaks.get(e.id) ?? 0,
    };
  });

  rows.sort((a, b) => b.score - a.score || b.videoCount - a.videoCount);
  return rows;
}

/**
 * The primary leaderboard: scoped to a single batch, not a calendar window.
 * A batch's standings freeze the moment the admin moves on to the next
 * batch — there's no reset schedule, the owner controls it directly.
 */
export async function getBatchLeaderboard(batchNumber: number): Promise<LeaderboardResult> {
  const rows = await computeLeaderboardRows({ batchNumber });
  return { rows };
}

export async function getMonthlyLeaderboard(): Promise<LeaderboardResult> {
  const rows = await computeLeaderboardRows({
    submittedAt: { gte: getMonthStart(), lt: getMonthEnd() },
  });
  return { rows };
}

export interface FirstToday {
  editorId: string;
  name: string;
  submittedAt: string;
}

export async function getFirstSubmitterToday(): Promise<FirstToday | null> {
  const todayStart = karachiTodayStart();
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);

  const first = await prisma.videoSubmission.findFirst({
    where: { submittedAt: { gte: todayStart, lt: todayEnd }, status: { not: "rejected" } },
    orderBy: { submittedAt: "asc" },
    select: { editorId: true, submittedAt: true, editor: { select: { name: true } } },
  });

  if (!first) return null;
  return { editorId: first.editorId, name: first.editor.name, submittedAt: first.submittedAt.toISOString() };
}

export interface PersonalStats {
  bestDayCount: number;
  bestDayDate: string | null;
  currentStreak: number;
  firstToday: boolean;
}

export async function getPersonalStats(editorId: string): Promise<PersonalStats> {
  const submissions = await prisma.videoSubmission.findMany({
    where: { editorId, status: { not: "rejected" } },
    select: { submittedAt: true },
  });

  const counts = new Map<string, { count: number; sample: Date }>();
  for (const s of submissions) {
    const key = karachiDateKey(s.submittedAt);
    const entry = counts.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      counts.set(key, { count: 1, sample: s.submittedAt });
    }
  }

  let bestDayCount = 0;
  let bestDaySample: Date | null = null;
  for (const { count, sample } of counts.values()) {
    if (count > bestDayCount) {
      bestDayCount = count;
      bestDaySample = sample;
    }
  }

  const days = new Set(counts.keys());
  const currentStreak = computeStreak(days);

  const firstToday = await getFirstSubmitterToday();

  return {
    bestDayCount,
    bestDayDate: bestDaySample ? bestDaySample.toISOString() : null,
    currentStreak,
    firstToday: firstToday?.editorId === editorId,
  };
}
