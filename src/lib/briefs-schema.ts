import { z } from "zod";

/*
 * The shape of one line on a brief checklist. Kept apart from lib/briefs.ts so
 * validation and client components can use it without pulling in the database.
 */

export const BRIEF_ITEM_SOURCES = ["rule", "brief", "manual"] as const;

export const briefItemSchema = z.object({
  id: z.string().min(1).max(64),
  category: z.string().trim().min(1).max(60),
  text: z.string().trim().min(1).max(300),
  detail: z.string().trim().max(1000).nullable().optional(),
  /// rule = a standing client rule, brief = read out of the brief, manual = typed by QA.
  from: z.enum(BRIEF_ITEM_SOURCES),
});

export type BriefItem = z.infer<typeof briefItemSchema>;

/** The group brief-specific checks sit under, at the top of the list. */
export const BRIEF_CATEGORY = "This brief";
