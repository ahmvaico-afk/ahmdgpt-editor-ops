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

export function dollarsToCents(dollars: number) {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number) {
  return cents / 100;
}
