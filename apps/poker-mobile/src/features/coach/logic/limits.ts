/**
 * Coach usage limits / credits / rate limiting — pure + testable. DORMANT in V1
 * (callers pass `enforce: false`), but fully implemented so cost controls can be turned
 * on later by flipping a flag — no rewrite. Monthly credits roll over on month change.
 */
export const COACH_USAGE_SCHEMA_VERSION = 1 as const;

export interface CoachLimits {
  /** Requests allowed per calendar month. */
  monthlyCredits: number;
  /** Minimum spacing between requests (rate limit), ms. */
  minIntervalMs: number;
}

export interface CoachUsage {
  schemaVersion: typeof COACH_USAGE_SCHEMA_VERSION;
  monthKey: string;        // yyyy-mm
  usedThisMonth: number;
  lastRequestAt?: string;  // ISO
}

export const monthKey = (now: number | Date = Date.now()): string =>
  new Date(now).toISOString().slice(0, 7);

export function emptyUsage(now: number | Date = Date.now()): CoachUsage {
  return { schemaVersion: COACH_USAGE_SCHEMA_VERSION, monthKey: monthKey(now), usedThisMonth: 0 };
}

/** Reset the monthly counter when the calendar month changes. */
export function rolloverIfNeeded(usage: CoachUsage, now: number | Date = Date.now()): CoachUsage {
  const mk = monthKey(now);
  if (usage.monthKey === mk) return usage;
  return { ...usage, monthKey: mk, usedThisMonth: 0 };
}

export function creditsRemaining(usage: CoachUsage, limits: CoachLimits, now: number | Date = Date.now()): number {
  const rolled = rolloverIfNeeded(usage, now);
  return Math.max(0, limits.monthlyCredits - rolled.usedThisMonth);
}

export type CoachDenyReason = 'rate_limited' | 'no_credits';
export interface CoachGate {
  allowed: boolean;
  reason?: CoachDenyReason;
  remaining: number;
}

/**
 * Decide whether an analysis may run. With `enforce: false` (V1) it always allows but
 * still reports `remaining` for display. With `enforce: true` it applies credits + rate limit.
 */
export function canAnalyze(
  usage: CoachUsage,
  limits: CoachLimits,
  now: number | Date = Date.now(),
  opts: { enforce?: boolean } = {},
): CoachGate {
  const rolled = rolloverIfNeeded(usage, now);
  const remaining = Math.max(0, limits.monthlyCredits - rolled.usedThisMonth);
  if (!opts.enforce) return { allowed: true, remaining };

  if (rolled.lastRequestAt) {
    const since = new Date(now).getTime() - new Date(rolled.lastRequestAt).getTime();
    if (since < limits.minIntervalMs) return { allowed: false, reason: 'rate_limited', remaining };
  }
  if (remaining <= 0) return { allowed: false, reason: 'no_credits', remaining };
  return { allowed: true, remaining };
}

/** Record one consumed analysis (after a successful provider call). */
export function recordUsage(usage: CoachUsage, now: number | Date = Date.now()): CoachUsage {
  const rolled = rolloverIfNeeded(usage, now);
  return { ...rolled, usedThisMonth: rolled.usedThisMonth + 1, lastRequestAt: new Date(now).toISOString() };
}
