import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getActiveRules } from "@/lib/rules";
import { ruleAppliesTo, type AdType } from "@/lib/ad-types";
import { briefAiAvailable, checksFromBrief } from "@/lib/brief-ai";
import { BRIEF_CATEGORY, type BriefItem } from "@/lib/briefs-schema";

export function newItemId() {
  return randomBytes(6).toString("hex");
}

/** Long enough that nobody stumbles onto someone else's brief. */
export function newShareCode() {
  return randomBytes(12).toString("base64url");
}

/**
 * The proposed checklist for a brief: checks read out of the brief itself
 * first, then every standing client rule for this kind of ad.
 */
export async function draftChecklist(adType: AdType, brief: string) {
  const rules = (await getActiveRules()).filter((r) => ruleAppliesTo(r, adType));
  const ruleItems: BriefItem[] = rules.map((r) => ({
    id: newItemId(),
    category: r.category,
    text: r.text,
    detail: r.detail,
    from: "rule",
  }));

  let briefItems: BriefItem[] = [];
  let aiNote: string | null = null;
  if (!briefAiAvailable()) {
    aiNote = "Brief reading isn't switched on yet, so only the standing rules are here. Add brief-specific lines below.";
  } else if (brief.trim()) {
    try {
      const checks = await checksFromBrief(brief, adType, rules.map((r) => r.text));
      briefItems = checks.map((c) => ({
        id: newItemId(),
        category: BRIEF_CATEGORY,
        text: c.text,
        detail: c.detail || null,
        from: "brief",
      }));
    } catch (err) {
      console.error("[briefs] reading the brief failed:", err);
      aiNote = "Couldn't read the brief this time, so only the standing rules are here. Try again, or add brief lines below.";
    }
  }

  return { items: [...briefItems, ...ruleItems], aiNote };
}

/** What the share page and lists need, with ticked ids that still exist. */
export function summarize(row: { items: unknown; checked: unknown }) {
  const items = (row.items as BriefItem[]) ?? [];
  const ids = new Set(items.map((i) => i.id));
  const checked = ((row.checked as string[]) ?? []).filter((id) => ids.has(id));
  return { items, checked, done: checked.length, total: items.length };
}

export async function findByCode(code: string) {
  return prisma.briefChecklist.findUnique({
    where: { code },
    include: { editor: { select: { name: true } } },
  });
}
