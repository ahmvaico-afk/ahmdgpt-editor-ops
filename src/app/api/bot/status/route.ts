import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBatch } from "@/lib/batch";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

/**
 * Read-only snapshot of the portal for the owner's private Telegram bot, which
 * runs on his PC (H:\CLAUDE CODE\ahmd-telegram-bot) and answers questions like
 * "what's pending QA today" or "which editor submitted what".
 *
 * There is no session cookie here — the bot sends `Authorization: Bearer <key>`.
 * Only the key's sha256 lives in the code, so nothing secret is committed and
 * no hosting env var has to be set. To rotate, generate a new key, put it in the
 * bot's .env, and either set BOT_API_KEY_SHA256 on the host or change the
 * constant below.
 *
 * GET only, no writes. Editor payouts are included (the bot is the owner's);
 * client billing rates are not — they sit behind the invoice password.
 */
const DEFAULT_KEY_SHA256 = "4d62089cd3b3b0bef90016e2e3075e12abbe437d526b28989966608acf16c229";

// Ahmed and the editors are in Pakistan (UTC+5, no daylight saving), and the
// server runs in UTC — "today" has to mean today in Karachi.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function isAuthorized(request: NextRequest): boolean {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!key) return false;
  const expected = Buffer.from(process.env.BOT_API_KEY_SHA256 || DEFAULT_KEY_SHA256, "hex");
  const actual = createHash("sha256").update(key).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function startOfTodayPkt(now: Date): Date {
  const pkt = new Date(now.getTime() + PKT_OFFSET_MS);
  pkt.setUTCHours(0, 0, 0, 0);
  return new Date(pkt.getTime() - PKT_OFFSET_MS);
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limitKey = `bot-status:${ip}`;
  if (!isAuthorized(request)) {
    const limit = checkRateLimit(limitKey);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
    }
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  resetRateLimit(limitKey);

  const now = new Date();
  const todayStart = startOfTodayPkt(now);
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  // Sequential, not Promise.all: concurrent queries through the pg driver
  // adapter's shared pool can corrupt prepared statements under load.
  const currentBatch = await getCurrentBatch();

  const awaitingQa = await prisma.videoSubmission.findMany({
    where: { status: "submitted" },
    orderBy: { submittedAt: "asc" },
    take: 60,
    select: {
      title: true,
      styleName: true,
      clientOrProject: true,
      batchNumber: true,
      durationMinutes: true,
      submittedAt: true,
      editor: { select: { name: true } },
      _count: { select: { revisions: true } },
    },
  });
  const awaitingQaTotal = await prisma.videoSubmission.count({ where: { status: "submitted" } });

  const submittedToday = await prisma.videoSubmission.findMany({
    where: { submittedAt: { gte: todayStart } },
    orderBy: { submittedAt: "asc" },
    take: 100,
    select: {
      title: true,
      styleName: true,
      clientOrProject: true,
      status: true,
      batchNumber: true,
      submittedAt: true,
      editor: { select: { name: true } },
    },
  });

  const weekByEditor = await prisma.videoSubmission.groupBy({
    by: ["editorId", "status"],
    where: { submittedAt: { gte: weekStart } },
    _count: true,
  });

  const revisionsToday = await prisma.revision.findMany({
    where: { createdAt: { gte: todayStart } },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      severity: true,
      reason: true,
      note: true,
      createdAt: true,
      submission: { select: { title: true, editor: { select: { name: true } } } },
    },
  });

  const timersRunning = await prisma.workSession.findMany({
    where: { endedAt: null },
    select: {
      startedAt: true,
      workItem: { select: { label: true, editor: { select: { name: true } } } },
    },
  });

  const timeAwaitingSignoff = await prisma.workItem.count({
    where: { status: { not: "working" }, timeApprovedAt: null },
  });

  const newApplicants = await prisma.applicant.count({
    where: { status: "new", autoFiltered: false },
  });
  const applicantsToday = await prisma.applicant.count({
    where: { createdAt: { gte: todayStart } },
  });

  const owed = await prisma.videoSubmission.aggregate({
    where: { status: { in: ["submitted", "approved"] } },
    _sum: { calculatedPriceCents: true },
    _count: true,
  });

  const editors = await prisma.editor.findMany({
    where: { active: true },
    select: { id: true, name: true, isQa: true },
    orderBy: { name: "asc" },
  });
  const editorName = new Map(editors.map((e) => [e.id, e.name]));

  const week = new Map<string, Record<string, number>>();
  for (const row of weekByEditor) {
    const name = editorName.get(row.editorId) ?? "(inactive editor)";
    const counts = week.get(name) ?? { submitted: 0, approved: 0, paid: 0, rejected: 0 };
    counts[row.status] += row._count;
    week.set(name, counts);
  }

  return NextResponse.json({
    generatedAt: now.toISOString(),
    timezone: "Asia/Karachi",
    currentBatch,
    awaitingQa: {
      total: awaitingQaTotal,
      items: awaitingQa.map((s) => ({
        editor: s.editor.name,
        title: s.title,
        style: s.styleName,
        client: s.clientOrProject,
        batch: s.batchNumber,
        minutes: s.durationMinutes,
        submittedAt: s.submittedAt,
        revisionsLogged: s._count.revisions,
      })),
    },
    submittedToday: submittedToday.map((s) => ({
      editor: s.editor.name,
      title: s.title,
      style: s.styleName,
      client: s.clientOrProject,
      status: s.status,
      batch: s.batchNumber,
      submittedAt: s.submittedAt,
    })),
    last7DaysByEditor: Array.from(week, ([editor, counts]) => ({ editor, ...counts })),
    revisionsToday: revisionsToday.map((r) => ({
      editor: r.submission.editor.name,
      video: r.submission.title,
      severity: r.severity === 3 ? "major" : r.severity === 2 ? "moderate" : "minor",
      reason: r.reason === "brief_change" ? "client brief change" : "editor mistake",
      note: r.note,
      at: r.createdAt,
    })),
    timersRunning: timersRunning.map((t) => ({
      editor: t.workItem.editor.name,
      workingOn: t.workItem.label,
      since: t.startedAt,
    })),
    timeAwaitingSignoff,
    applicants: { newUnreviewed: newApplicants, arrivedToday: applicantsToday },
    owedToEditorsPkr: {
      amount: Math.round((owed._sum.calculatedPriceCents ?? 0) / 100),
      videos: owed._count,
    },
    activeEditors: editors.map((e) => ({ name: e.name, isQa: e.isQa })),
  });
}
