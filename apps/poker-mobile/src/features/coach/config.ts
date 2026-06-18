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
  /** Require a verified signed-in account before analyzing (anti-abuse). Dormant in V1. */
  requireAccount: boolean;
  /** Per-tier minimum interval between requests (rate limit). Monthly credits now come
   *  from the entitlement tier (account-based quota), not here. */
  freeRateMs: number;
  premiumRateMs: number;
}

export const COACH_CONFIG: CoachConfig = {
  provider: 'mock',
  enforceLimits: false,
  requireAccount: false,
  freeRateMs: 4000,
  premiumRateMs: 1500,
};
