/**
 * Coach configuration — vendor switch + cost-control master switches.
 * V2 monetization: enforcement + verified-account requirement are ON (fail-closed) within
 * the (flag-gated) coach feature. The AI credit allowance + rate limit come from the
 * entitlement tier's AiCreditPolicy (premium/config), not here.
 */
export type CoachProviderId = 'mock' | 'openai' | 'anthropic' | 'gemini' | 'self';

export interface CoachConfig {
  /** Active AI provider. 'mock' until a vendor is wired. */
  provider: CoachProviderId;
  /** Enforce credits + rate limit (fail-closed). */
  enforceLimits: boolean;
  /** Require a verified signed-in account — no anonymous AI. */
  requireAccount: boolean;
}

export const COACH_CONFIG: CoachConfig = {
  provider: 'mock',
  enforceLimits: true,
  requireAccount: true,
};
