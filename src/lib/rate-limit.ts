const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, number[]>();

/**
 * In-memory sliding-window limiter. Good enough for a single-instance deploy;
 * resets on cold start and doesn't share state across serverless instances.
 * Swap for Upstash Redis (or similar) if brute-force resistance needs to hold
 * across a multi-instance production deployment.
 *
 * `max` is per caller because the two uses want opposite things. A login
 * endpoint wants a tight cap — eight guesses is already generous. A public
 * form wants a loose one: Pakistani mobile carriers put thousands of users
 * behind one NAT address, so a cap tuned for brute force would lock out real
 * applicants the moment an ad starts delivering.
 */
export function checkRateLimit(
  key: string,
  max: number = MAX_ATTEMPTS,
): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const history = (attempts.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);

  if (history.length >= max) {
    const retryAfterMs = WINDOW_MS - (now - history[0]);
    return { allowed: false, retryAfterMs };
  }

  history.push(now);
  attempts.set(key, history);
  return { allowed: true };
}

export function resetRateLimit(key: string) {
  attempts.delete(key);
}
