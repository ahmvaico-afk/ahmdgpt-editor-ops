/**
 * Editor performance meters.
 *
 * The whole point of scoring speed and quality together is that neither works
 * alone: reward speed only and you pay people to rush, reward a clean record
 * only and you pay them to polish forever. The only way to score well here is
 * to get it right the first time, quickly.
 *
 * Every rate is normalised so a 2-minute video and a 10-minute one compare on
 * equal terms — see `EFFICIENCY` below.
 */
import { prisma } from "@/lib/prisma";

/**
 * What one revision costs, as a percentage off that video's perfect score.
 * A typo and a re-edit are not the same mistake, so severity is weighted
 * rather than revisions being counted.
 */
export const REVISION_COST = {
  1: 6, // minor
  2: 15, // moderate
  3: 30, // major
} as const;

export const SEVERITY_LABELS: Record<number, string> = {
  1: "Minor",
  2: "Moderate",
  3: "Major",
};

/**
 * Sessions longer than this are almost certainly a timer someone forgot to
 * stop. They are capped rather than dropped — the work probably happened, we
 * just can't believe the tail of it — and flagged so the owner can look.
 */
export const MAX_SESSION_HOURS = 6;

/** Below this many videos a meter is too small a sample to rank on. */
export const MIN_VIDEOS_FOR_RANKING = 3;

export interface EditorMeter {
  editorId: string;
  name: string;
  editorCode: string;
  videoCount: number;

  /** 100 = nothing ever came back. Only editor_error revisions deduct. */
  meter: number;
  /** Revisions that were the editor's fault. */
  editorRevisions: number;
  /** Revisions caused by a changed brief — shown, but never penalised. */
  briefRevisions: number;
  /** Share of videos QA passed with no editor-error revision at all. */
  firstTimePassRate: number;

  /** Total minutes the editor actually had the clock running. */
  activeMinutes: number;
  /** Minutes of work per finished minute of video — the length-fair speed. */
  minutesPerFinishedMinute: number | null;
  /** Rupees of output delivered per hour worked — the style-fair speed. */
  rupeesPerHour: number | null;

  /** True once there are enough videos to take the numbers seriously. */
  ranked: boolean;
  /** Any session that hit the cap, i.e. a timer probably left running. */
  flaggedSessions: number;
}

/** Clamped so a catastrophic run bottoms out at 0 rather than going negative. */
function meterFromPenalty(totalPenalty: number, videoCount: number): number {
  if (videoCount === 0) return 100;
  return Math.max(0, Math.min(100, Math.round(100 - totalPenalty / videoCount)));
}

/**
 * Milliseconds an editor actually worked, capped per session.
 * An open session counts up to now, so a running timer shows live.
 */
function sessionMs(startedAt: Date, endedAt: Date | null, now: number): number {
  const end = endedAt ? endedAt.getTime() : now;
  const raw = end - startedAt.getTime();
  if (raw <= 0) return 0;
  return Math.min(raw, MAX_SESSION_HOURS * 3600_000);
}

export async function getEditorMeters(batchNumber?: number | null): Promise<EditorMeter[]> {
  const now = Date.now();
  const where = batchNumber != null ? { batchNumber } : {};

  // Sequential, not Promise.all: concurrent queries through the pg driver
  // adapter's shared pool can corrupt prepared statements under load.
  const editors = await prisma.editor.findMany({ orderBy: { name: "asc" } });
  const submissions = await prisma.videoSubmission.findMany({
    where: { ...where, status: { not: "rejected" } },
    select: {
      id: true,
      editorId: true,
      durationMinutes: true,
      calculatedPriceCents: true,
      revisions: { select: { severity: true, reason: true } },
      workSessions: { select: { startedAt: true, endedAt: true } },
    },
  });

  const byEditor = new Map<string, typeof submissions>();
  for (const s of submissions) {
    const list = byEditor.get(s.editorId) ?? [];
    list.push(s);
    byEditor.set(s.editorId, list);
  }

  const rows: EditorMeter[] = [];

  for (const editor of editors) {
    const mine = byEditor.get(editor.id) ?? [];
    if (mine.length === 0) continue;

    let penalty = 0;
    let editorRevisions = 0;
    let briefRevisions = 0;
    let cleanVideos = 0;
    let workedMs = 0;
    let timedMinutes = 0;
    let timedCents = 0;
    let flagged = 0;

    for (const s of mine) {
      let videoPenalty = 0;
      let hadEditorFault = false;

      for (const r of s.revisions) {
        if (r.reason === "brief_change") {
          briefRevisions += 1;
          continue;
        }
        editorRevisions += 1;
        hadEditorFault = true;
        videoPenalty += REVISION_COST[r.severity as 1 | 2 | 3] ?? REVISION_COST[1];
      }

      // Capped per video: one disastrous video shouldn't drag the whole meter
      // further than a total write-off of that video would.
      penalty += Math.min(videoPenalty, 100);
      if (!hadEditorFault) cleanVideos += 1;

      let videoMs = 0;
      for (const w of s.workSessions) {
        const ms = sessionMs(w.startedAt, w.endedAt, now);
        if (ms >= MAX_SESSION_HOURS * 3600_000) flagged += 1;
        videoMs += ms;
      }
      workedMs += videoMs;

      // Only videos that were actually timed feed the speed figures, so an
      // untimed video doesn't read as infinitely fast.
      if (videoMs > 0) {
        timedMinutes += s.durationMinutes;
        timedCents += s.calculatedPriceCents;
      }
    }

    const activeMinutes = workedMs / 60_000;
    const hours = activeMinutes / 60;

    rows.push({
      editorId: editor.id,
      name: editor.name,
      editorCode: editor.editorCode,
      videoCount: mine.length,
      meter: meterFromPenalty(penalty, mine.length),
      editorRevisions,
      briefRevisions,
      firstTimePassRate: mine.length === 0 ? 1 : cleanVideos / mine.length,
      activeMinutes: Math.round(activeMinutes),
      minutesPerFinishedMinute:
        timedMinutes > 0 ? activeMinutes / timedMinutes : null,
      rupeesPerHour: hours > 0 && timedCents > 0 ? timedCents / 100 / hours : null,
      ranked: mine.length >= MIN_VIDEOS_FOR_RANKING,
      flaggedSessions: flagged,
    });
  }

  // Best meter first; ties broken by who needed fewer revisions per video.
  rows.sort((a, b) => b.meter - a.meter || a.editorRevisions - b.editorRevisions);
  return rows;
}

/** The editor's currently running timer, if any. */
export async function getOpenSession(editorId: string) {
  return prisma.workSession.findFirst({
    where: { editorId, endedAt: null },
    orderBy: { startedAt: "desc" },
    include: { submission: { select: { id: true, title: true } } },
  });
}
