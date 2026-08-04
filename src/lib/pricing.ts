/**
 * Two pricing shapes, chosen by whether the style has a step increment:
 *
 * - Step pricing (incrementPerMinuteCents > 0): flat base rate covers the
 *   first minute, then every additional minute adds a flat increment.
 *   E.g. Rs2000 base + Rs500 step on a 3-minute video = 2000 + 2×500 = Rs3000
 *   (1 min → 2000, 2 min → 2500, 3 min → 3000).
 * - Plain per-minute (incrementPerMinuteCents = 0): duration × rate.
 */
export function calculatePriceCents(
  durationMinutes: number,
  ratePerMinuteCents: number,
  incrementPerMinuteCents = 0
) {
  if (incrementPerMinuteCents > 0) {
    const extraMinutes = Math.max(0, durationMinutes - 1);
    return Math.round(ratePerMinuteCents + incrementPerMinuteCents * extraMinutes);
  }
  return Math.round(durationMinutes * ratePerMinuteCents);
}

export function formatCents(cents: number) {
  return (cents / 100).toLocaleString("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUsdCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface ClientPricingConfig {
  clientRatePerMinuteCents: number;
  clientPerMinuteIncrementCents: number;
  clientBaseSeconds: number;
  clientOverageUnitSeconds: number;
  clientOverageGraceSeconds: number;
  clientOverageProportional: boolean;
}

/**
 * Client invoice pricing — deliberately separate from calculatePriceCents
 * (editor payout). Three shapes, chosen by config:
 *
 * - clientBaseSeconds = 0: plain per-minute rate (duration x rate). E.g.
 *   Faceless: $30/min flat.
 * - clientBaseSeconds > 0, proportional: flat base price covers up to that
 *   many seconds, then overage bills continuously per clientOverageUnitSeconds
 *   (e.g. Veo 3: $20 up to 2:00, then $5/min prorated beyond).
 * - clientBaseSeconds > 0, stepped: same base, but overage only advances to
 *   the next unit once more than clientOverageGraceSeconds past the boundary
 *   (e.g. Talking Head + B-Roll: $40 up to 2:00, then $5 per 30s tier, with a
 *   5s grace so 2:31 doesn't round up to the next tier but 2:36 does).
 */
export function calculateClientPriceCents(
  durationMinutes: number,
  style: ClientPricingConfig
): number {
  if (style.clientBaseSeconds <= 0) {
    return Math.round(durationMinutes * style.clientRatePerMinuteCents);
  }

  const durationSeconds = Math.round(durationMinutes * 60);
  if (durationSeconds <= style.clientBaseSeconds) {
    return style.clientRatePerMinuteCents;
  }

  const overageSeconds = durationSeconds - style.clientBaseSeconds;
  const unit = style.clientOverageUnitSeconds > 0 ? style.clientOverageUnitSeconds : 60;

  if (style.clientOverageProportional) {
    const units = overageSeconds / unit;
    return Math.round(style.clientRatePerMinuteCents + units * style.clientPerMinuteIncrementCents);
  }

  let tier = 0;
  let boundary = unit;
  while (overageSeconds > boundary + style.clientOverageGraceSeconds) {
    tier += 1;
    boundary += unit;
  }
  return style.clientRatePerMinuteCents + tier * style.clientPerMinuteIncrementCents;
}

export function dollarsToCents(dollars: number) {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number) {
  return cents / 100;
}
