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

/** Anything faster than this and they didn't read the questions. */
export const MIN_SECONDS = 30;

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
