/**
 * Monetization config — the SINGLE source of tunable knobs (pricing, products, premium
 * features, AI credit policy per tier). Shaped so quotas/prices can later be replaced by
 * a remote-config fetch with no code changes. Profit-protective defaults; fail-closed.
 */
export type PremiumTier = 'free' | 'premium';

/**
 * B4 — when true, the SERVER is the single source of truth for entitlements + AI credits. The client
 * fetches `GET /api/entitlements` + `GET /api/coach/credits` and routes analyses through
 * `POST /api/coach/analyze`; local state is only a fail-closed offline cache, never authority.
 */
export const SERVER_AUTHORITATIVE = true;

export type AiCreditKind = 'lifetime' | 'monthly';
export interface AiCreditPolicy {
  /** 'lifetime' = a one-time allowance (free onboarding taste); 'monthly' = resets each month. */
  kind: AiCreditKind;
  /** Number of AI analyses allowed. 0 = no access. */
  credits: number;
  /** Minimum spacing between analyses (rate limit), ms. */
  minIntervalMs: number;
}

/**
 * AI Coach access per tier. Free = 1 LIFETIME onboarding analysis (verified accounts only;
 * guests get 0 — enforced separately). Premium = 30 / month. Tune here (or via remote config).
 */
export const AI_CREDIT_POLICY: Record<PremiumTier, AiCreditPolicy> = {
  free:    { kind: 'lifetime', credits: 1,  minIntervalMs: 4000 },
  premium: { kind: 'monthly',  credits: 30, minIntervalMs: 1500 },
};

export type BillingPeriod = 'month' | 'year';
export interface PremiumPlan {
  productId: string;
  price: string;       // display string; real localized price comes from the billing SDK later
  period: BillingPeriod;
  perMonth?: string;
  savePct?: number;
}

export const PRICING: { monthly: PremiumPlan; yearly: PremiumPlan } = {
  monthly: { productId: 'tpoker.premium.monthly', price: '$11.99', period: 'month' },
  yearly:  { productId: 'tpoker.premium.yearly',  price: '$79.99', period: 'year', perMonth: '$6.67', savePct: 44 },
};

export type PremiumFeatureKey =
  | 'advanced_gto' | 'ai_coach' | 'advanced_bankroll' | 'cloud_sync' | 'premium_learning';

export const PREMIUM_FEATURES: { key: PremiumFeatureKey; icon: string; title: string; desc: string }[] = [
  { key: 'ai_coach',          icon: 'sparkles',       title: 'AI Coach',                desc: '30 hand analyses every month' },
  { key: 'advanced_gto',      icon: 'school',         title: 'Advanced GTO study',      desc: 'Deeper ranges, sizings & spots' },
  { key: 'advanced_bankroll', icon: 'stats-chart',    title: 'Advanced bankroll analytics', desc: 'Variance, filters & deeper trends' },
  { key: 'cloud_sync',        icon: 'cloud-done',     title: 'Cloud sync',              desc: 'Your data, across all devices' },
  { key: 'premium_learning',  icon: 'library',        title: 'Premium learning',        desc: 'Future courses & study paths' },
];
