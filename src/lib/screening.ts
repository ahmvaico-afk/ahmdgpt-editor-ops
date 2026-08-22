/**
 * The bar an application has to clear before a human reads it.
 *
 * Every check here is trivial for someone actually reading the form and
 * impossible for someone tabbing through to get it over with. Nothing is
 * rejected outright — failures are sorted into their own pile so the main list
 * stays clean, but the owner can still look if they want.
 */

/** Word the applicant is asked to type back. */
export const ATTENTION_WORD = "reel";

/** Both sides of the sum, so the question text and the marking can't drift. */
export const MATH_A = 6;
export const MATH_B = 7;

/** Hours in two days. Trivially checkable, catches anyone guessing. */
export const HOURS_IN_TWO_DAYS = 48;

export const SCENARIO_OPTIONS = [
  { value: "redo", label: "Ask exactly what's wrong and redo it" },
  { value: "resend", label: "Send the same file again and hope" },
  { value: "argue", label: "Tell them the edit is already fine" },
  { value: "ghost", label: "Stop replying" },
] as const;

export const SCENARIO_CORRECT = "redo";

/** Anything faster than this and they didn't read the questions. */
export const MIN_SECONDS = 30;

export interface ScreeningInput {
  attentionAnswer: string;
  mathAnswer: string;
  hoursAnswer: string;
  scenarioAnswer: string;
  secondsTaken: number;
  ownsComputer: boolean;
}

export interface ScreeningResult {
  attentionPassed: boolean;
  checksPassed: number;
  checksTotal: number;
  autoFiltered: boolean;
  filterReason: string | null;
}

/** Digits only, so "48 hours" and " 48 " both count. */
function numeric(value: string): number | null {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits === "") return null;
  return Number(digits);
}

export function screenApplicant(input: ScreeningInput): ScreeningResult {
  const attentionPassed =
    input.attentionAnswer.trim().toLowerCase() === ATTENTION_WORD;
  const mathPassed = numeric(input.mathAnswer) === MATH_A + MATH_B;
  const hoursPassed = numeric(input.hoursAnswer) === HOURS_IN_TWO_DAYS;
  const scenarioPassed = input.scenarioAnswer === SCENARIO_CORRECT;

  const checksPassed = [attentionPassed, mathPassed, hoursPassed, scenarioPassed].filter(
    Boolean,
  ).length;
  const checksTotal = 4;

  // Ordered by how decisive each reason is, so the label explains the most
  // damning thing rather than whichever happened to be checked first.
  let filterReason: string | null = null;
  if (checksPassed <= 1) {
    filterReason = `Failed ${checksTotal - checksPassed} of ${checksTotal} checks`;
  } else if (!input.ownsComputer) {
    filterReason = "No computer — phone only";
  } else if (input.secondsTaken > 0 && input.secondsTaken < MIN_SECONDS) {
    filterReason = `Rushed the form in ${input.secondsTaken}s`;
  } else if (checksPassed === 2) {
    filterReason = `Failed 2 of ${checksTotal} checks`;
  }

  return {
    attentionPassed,
    checksPassed,
    checksTotal,
    autoFiltered: filterReason !== null,
    filterReason,
  };
}
