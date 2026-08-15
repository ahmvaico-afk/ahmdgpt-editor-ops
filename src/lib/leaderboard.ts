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
  /** Base points before quality and speed are applied. */
  basePoints: number;
  /** Quality meter, 0-100. Scales the base — revisions cost you points. */
  meter: number;
  /** Speed against the batch median, 0.85-1.15. 1 when nothing was timed. */
  speedFactor: number;
  /** Minutes worked per finished minute of video, from approved videos only. */
  minutesPerFinishedMinute: number | null;
  editorRevisions: number;
}

/** Mirrors REVISION_COST in lib/meters.ts — minor, moderate, major. */
const REVISION_PENALTY: Record<number, number> = { 1: 6, 2: 15, 3: 30 };

/**
 * How far speed is allowed to move a score. Deliberately narrow: the clock is
 * self-reported, so it nudges the ranking rather than deciding it.
 */
const SPEED_FLOOR = 0.85;
const SPEED_CEILING = 1.15;

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
 * Score = volume and turning up, scaled by quality, nudged by speed.
 *
 *   base  = 10pts/video + 15pts per distinct day with a submission
 *   meter = 100 minus the average revision cost per video (editor's fault only)
 *   speed = the batch median pace divided by yours, clamped
 *
 * The three multiply, which is the point: rushing out sloppy work raises the
 * base but sinks the meter, and polishing forever protects the meter but drags
 * the pace. Winning means clean work, quickly.
 *
 * Speed only counts approved or paid videos — an unapproved video isn't
 * finished work yet, so its clock isn't final.
 */
async function computeLeaderboardRows(
  where: Prisma.VideoSubmissionWhereInput
): Promise<LeaderboardRow[]> {
  const editors = await prisma.editor.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  // Sequential, not Promise.all: concurrent queries through the pg driver
  // adapter's shared pool can corrupt prepared statements under load.
  const submissions = await prisma.videoSubmission.findMany({
    where: { ...where, status: { not: "rejected" } },
    select: {
      editorId: true,
      submittedAt: true,
      status: true,
      durationMinutes: true,
      revisions: { select: { severity: true, reason: true } },
      workSessions: { select: { startedAt: true, endedAt: true } },
    },
  });
  const streaks = await getStreakMap();

  type Tally = {
    count: number;
    days: Set<string>;
    penalty: number;
    editorRevisions: number;
    workedMinutes: number;
    finishedMinutes: number;
  };
  const byEditor = new Map<string, Tally>();

  for (const s of submissions) {
    const entry: Tally = byEditor.get(s.editorId) ?? {
      count: 0,
      days: new Set<string>(),
      penalty: 0,
      editorRevisions: 0,
      workedMinutes: 0,
      finishedMinutes: 0,
    };
    entry.count += 1;
    entry.days.add(karachiDateKey(s.submittedAt));

    let videoPenalty = 0;
    for (const r of s.revisions) {
      if (r.reason === "brief_change") continue;
      entry.editorRevisions += 1;
      videoPenalty += REVISION_PENALTY[r.severity] ?? REVISION_PENALTY[1];
    }
    // Capped per video: one disaster shouldn't cost more than writing that
    // video off entirely.
    entry.penalty += Math.min(videoPenalty, 100);

    const settled = s.status === "approved" || s.status === "paid";
    if (settled && s.workSessions.length > 0) {
      let ms = 0;
      for (const w of s.workSessions) {
        if (!w.endedAt) continue;
        ms += Math.max(0, w.endedAt.getTime() - w.startedAt.getTime());
      }
      if (ms > 0) {
        entry.workedMinutes += ms / 60_000;
        entry.finishedMinutes += s.durationMinutes;
      }
    }

    byEditor.set(s.editorId, entry);
  }

  // Everyone's pace, so each editor can be measured against the batch median
  // rather than an arbitrary target.
  const paces: number[] = [];
  for (const t of byEditor.values()) {
    if (t.finishedMinutes > 0) paces.push(t.workedMinutes / t.finishedMinutes);
  }
  paces.sort((a, b) => a - b);
  const medianPace =
    paces.length === 0
      ? null
      : paces.length % 2 === 1
        ? paces[(paces.length - 1) / 2]
        : (paces[paces.length / 2 - 1] + paces[paces.length / 2]) / 2;

  const rows: LeaderboardRow[] = editors.map((e) => {
    const entry = byEditor.get(e.id);
    const videoCount = entry?.count ?? 0;
    const activeDays = entry?.days.size ?? 0;
    const basePoints = videoCount * 10 + activeDays * 15;

    const meter =
      videoCount === 0
        ? 100
        : Math.max(0, Math.min(100, Math.round(100 - (entry?.penalty ?? 0) / videoCount)));

    const pace =
      entry && entry.finishedMinutes > 0 ? entry.workedMinutes / entry.finishedMinutes : null;
    // Neutral when there's nothing to compare — nobody is punished for the
    // clock being new, or for being the only one who timed anything.
    const speedFactor =
      pace != null && medianPace != null && pace > 0
        ? Math.max(SPEED_FLOOR, Math.min(SPEED_CEILING, medianPace / pace))
        : 1;

    return {
      editorId: e.id,
      name: e.name,
      videoCount,
      activeDays,
      score: Math.round(basePoints * (meter / 100) * speedFactor),
      streak: streaks.get(e.id) ?? 0,
      basePoints,
      meter,
      speedFactor: Number(speedFactor.toFixed(3)),
      minutesPerFinishedMinute: pace,
      editorRevisions: entry?.editorRevisions ?? 0,
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
