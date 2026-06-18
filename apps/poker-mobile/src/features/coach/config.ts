/**
 * Coach configuration — the single place to (later) switch AI vendor and turn on cost
 * controls. All dormant in V1: `provider: 'mock'`, `enforceLimits: false`. Flipping these
 * activates a real provider + credits/rate-limiting without touching UI or service code.
 */
import type { CoachLimits } from './logic/limits';

export type CoachProviderId = 'mock' | 'openai' | 'anthropic' | 'gemini' | 'self';

export interface CoachConfig {
  /** Active AI provider. 'mock' until a vendor is wired. */
  provider: CoachProviderId;
  /** Master switch for usage limits / credits / rate limiting (dormant in V1). */
  enforceLimits: boolean;
  /** Per-tier monthly credits + min interval between requests (rate limit). */
  freeLimits: CoachLimits;
  premiumLimits: CoachLimits;
}

export const COACH_CONFIG: CoachConfig = {
  provider: 'mock',
  enforceLimits: false,
  freeLimits: { monthlyCredits: 20, minIntervalMs: 4000 },
  premiumLimits: { monthlyCredits: 500, minIntervalMs: 1500 },
};
