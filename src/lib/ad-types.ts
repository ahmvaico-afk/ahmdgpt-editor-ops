/*
 * The two kinds of ad editors make. Each gets its own checklist: a client rule
 * applies to one kind, or to both ("all"). AI UGC ads are a talking actor and
 * have no story B-roll, so the B-roll rules would only be noise there.
 */

export const AD_TYPES = ["ugc", "broll"] as const;
export type AdType = (typeof AD_TYPES)[number];

export const RULE_SCOPES = ["all", ...AD_TYPES] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

export const AD_TYPE_LABELS: Record<AdType, string> = {
  ugc: "AI UGC ad",
  broll: "B-roll video",
};

export const RULE_SCOPE_LABELS: Record<RuleScope, string> = {
  all: "Both",
  ugc: "AI UGC ads only",
  broll: "B-roll videos only",
};

export function ruleAppliesTo(rule: { appliesTo: string }, adType: AdType) {
  return rule.appliesTo === "all" || rule.appliesTo === adType;
}
