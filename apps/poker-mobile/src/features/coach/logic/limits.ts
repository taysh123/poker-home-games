/**
 * AI Coach credit engine — pure + testable. Account-based, FAIL-CLOSED. Supports both a
 * lifetime allowance (free onboarding taste) and a monthly quota (premium). Hard rules:
 * no anonymous AI (guests denied), never unlimited, deny if anything can't be verified.
 * Client enforces for UX; the server becomes the source of truth before public paid launch.
 */
import type { AiCreditPolicy } from '../../premium/config';

export const COACH_USAGE_SCHEMA_VERSION = 1 as const;

export interface CoachUsage {
  schemaVersion: typeof COACH_USAGE_SCHEMA_VERSION;
  monthKey: string;        // yyyy-mm
  usedThisMonth: number;
  usedLifetime: number;    // never resets (drives the free lifetime allowance)
  lastRequestAt?: string;  // ISO
}

export const monthKey = (now: number | Date = Date.now()): string =>
  new Date(now).toISOString().slice(0, 7);

export function emptyUsage(now: number | Date = Date.now()): CoachUsage {
  return { schemaVersion: COACH_USAGE_SCHEMA_VERSION, monthKey: monthKey(now), usedThisMonth: 0, usedLifetime: 0 };
}

/** Normalize a possibly-partial stored usage (older entries may lack usedLifetime). */
export function normalizeUsage(stored: Partial<CoachUsage> | undefined, now: number | Date = Date.now()): CoachUsage {
  return { ...emptyUsage(now), ...stored };
}

/** Reset the monthly counter when the calendar month changes (lifetime persists). */
export function rolloverIfNeeded(usage: CoachUsage, now: number | Date = Date.now()): CoachUsage {
  const mk = monthKey(now);
  if (usage.monthKey === mk) return usage;
  return { ...usage, monthKey: mk, usedThisMonth: 0 };
}

/** Used count relevant to the policy kind. */
function usedFor(policy: AiCreditPolicy, usage: CoachUsage): number {
  return policy.kind === 'lifetime' ? usage.usedLifetime : usage.usedThisMonth;
}

export function creditsRemaining(usage: CoachUsage, policy: AiCreditPolicy | undefined, now: number | Date = Date.now()): number {
  if (!policy) return 0; // fail-closed
  const rolled = rolloverIfNeeded(usage, now);
  return Math.max(0, policy.credits - usedFor(policy, rolled));
}

export type CoachDenyReason = 'requires_account' | 'rate_limited' | 'no_credits';
export interface CoachGate {
  allowed: boolean;
  reason?: CoachDenyReason;
  remaining: number;
}

export interface GateOptions {
  /** Enforce the gate (false = display-only). */
  enforce: boolean;
  /** Whether the caller is a verified signed-in account. */
  signedIn: boolean;
  /** Require a verified account (no anonymous AI). */
  requireAccount: boolean;
}

/**
 * Decide whether an analysis may run — fail-closed: unknown policy, or required account
 * missing, denies. Guests never get AI when requireAccount is on.
 */
export function canAnalyze(
  usage: CoachUsage,
  policy: AiCreditPolicy | undefined,
  now: number | Date = Date.now(),
  opts: GateOptions,
): CoachGate {
  if (!policy) return { allowed: false, reason: 'no_credits', remaining: 0 }; // fail-closed
  const rolled = rolloverIfNeeded(usage, now);
  const remaining = Math.max(0, policy.credits - usedFor(policy, rolled));

  // Hard rule: no anonymous AI (independent of `enforce`).
  if (opts.requireAccount && !opts.signedIn) return { allowed: false, reason: 'requires_account', remaining: 0 };

  if (!opts.enforce) return { allowed: true, remaining };

  if (rolled.lastRequestAt) {
    const since = new Date(now).getTime() - new Date(rolled.lastRequestAt).getTime();
    if (since < policy.minIntervalMs) return { allowed: false, reason: 'rate_limited', remaining };
  }
  if (remaining <= 0) return { allowed: false, reason: 'no_credits', remaining };
  return { allowed: true, remaining };
}

/** Record one consumed analysis (after a successful provider call). Tracks both counters. */
export function recordUsage(usage: CoachUsage, now: number | Date = Date.now()): CoachUsage {
  const rolled = rolloverIfNeeded(usage, now);
  return {
    ...rolled,
    usedThisMonth: rolled.usedThisMonth + 1,
    usedLifetime: rolled.usedLifetime + 1,
    lastRequestAt: new Date(now).toISOString(),
  };
}
