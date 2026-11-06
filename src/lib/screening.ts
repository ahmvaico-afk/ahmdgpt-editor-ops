/**
 * The bar an application has to clear before a human reads it.
 *
 * Every check here is trivial for someone actually reading the form and
 * impossible for someone tabbing through to get it over with. Nothing is
 * rejected outright — failures are sorted into their own pile so the main list
 * stays clean, but the owner can still look if they want.
 */

/**
 * Word the applicant is asked to type back. One check, not a quiz — puzzles and
 * arithmetic annoy the good applicants as much as the bad ones, and this alone
 * catches anyone tabbing through without reading.
 */
export const ATTENTION_WORD = "reel";

/**
 * Anything faster than this and they didn't read the questions. Lowered when
 * the form dropped to nine questions — on the old fourteen-question version
 * thirty seconds was impossible, but a fast, genuine applicant can now finish
 * inside that, and filtering those out costs more than the odd bot getting in.
 */
export const MIN_SECONDS = 18;

/**
 * Which market an application came from, worked out from the WhatsApp number
 * rather than asked for.
 *
 * Asking would mean a new column, and migrations on the live database have to
 * be applied by hand here — a step that has silently failed to happen more
 * than once, with recruitment ads running. The number is already collected and
 * already required, and it gives the same answer: Pakistani and Filipino
 * mobile numbers are unmistakable, in both the international form and the
 * local form people actually type.
 *
 * It also sorts every application already in the pile, which a new question
 * never could — those people have long since filled the form.
 */
export const COUNTRY_LABELS: Record<string, string> = {
  pk: "Pakistan",
  ph: "Philippines",
  other: "Somewhere else",
};

export type CountryValue = "pk" | "ph" | "other";

export function countryFromPhone(whatsapp: string): CountryValue {
  // Everything that isn't a digit goes: people type +92 300, 0092-300,
  // (0300) 123 4567 and every spacing in between.
  const digits = whatsapp.replace(/\D/g, "");

  // Dialling code, with or without the 00 trunk prefix in front of it.
  const international = digits.replace(/^00/, "");
  if (international.startsWith("92")) return "pk";
  if (international.startsWith("63")) return "ph";

  // The local mobile form, which is what most people type. Both countries
  // write it as eleven digits starting 0, then 3 for Pakistan and 9 for the
  // Philippines — 0300 1234567 and 0917 123 4567. Requiring the full eleven
  // keeps landlines and half-typed numbers out of both buckets.
  if (digits.length === 11 && digits.startsWith("03")) return "pk";
  if (digits.length === 11 && digits.startsWith("09")) return "ph";

  return "other";
}

/**
 * Where they saw the post. The channel is a fixed list so answers group
 * cleanly — free text alone gives you "insta", "IG" and "Instagram story" with
 * no way to count them — but the channel on its own is nearly useless. The
 * exact page, group or server is the answer that matters, so every option asks
 * for it and the wording changes to suit.
 */
export const SOURCE_OPTIONS = [
  {
    value: "instagram",
    label: "Instagram",
    detailLabel: "Which account did you see it on?",
    placeholder: "e.g. @ahmd.gpt",
  },
  {
    value: "facebook",
    label: "Facebook group",
    detailLabel: "Which group?",
    placeholder: "e.g. Video Editors Pakistan",
  },
  {
    value: "discord",
    label: "Discord server",
    detailLabel: "Which server?",
    placeholder: "e.g. HUGC",
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    detailLabel: "Which group, or who sent it?",
    placeholder: "Group name or person",
  },
  {
    value: "friend",
    label: "A friend told me",
    detailLabel: "Who told you?",
    placeholder: "Their name",
  },
  {
    value: "other",
    label: "Somewhere else",
    detailLabel: "Where exactly?",
    placeholder: "Name the page, site or app",
  },
] as const;

export type SourceValue = (typeof SOURCE_OPTIONS)[number]["value"];

export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_OPTIONS.map((o) => [o.value, o.label]),
);

export function sourceDetailLabel(value: string): string {
  return (
    SOURCE_OPTIONS.find((o) => o.value === value)?.detailLabel ?? "Where exactly?"
  );
}

export function sourceDetailPlaceholder(value: string): string {
  return SOURCE_OPTIONS.find((o) => o.value === value)?.placeholder ?? "Name it";
}

/** Guards against "idk", "fb", "yes" — too short to identify anything. */
export const MIN_SOURCE_DETAIL = 3;

export interface ScreeningInput {
  attentionAnswer: string;
  secondsTaken: number;
  ownsComputer: boolean;
}

export interface ScreeningResult {
  attentionPassed: boolean;
  autoFiltered: boolean;
  filterReason: string | null;
}

export function screenApplicant(input: ScreeningInput): ScreeningResult {
  const attentionPassed = input.attentionAnswer.trim().toLowerCase() === ATTENTION_WORD;

  // Ordered by how decisive each reason is, so the label explains the most
  // damning thing rather than whichever happened to be checked first.
  let filterReason: string | null = null;
  if (!attentionPassed) {
    filterReason = "Didn't read the form";
  } else if (!input.ownsComputer) {
    filterReason = "No computer — phone only";
  } else if (input.secondsTaken > 0 && input.secondsTaken < MIN_SECONDS) {
    filterReason = `Rushed the form in ${input.secondsTaken}s`;
  }

  return {
    attentionPassed,
    autoFiltered: filterReason !== null,
    filterReason,
  };
}
