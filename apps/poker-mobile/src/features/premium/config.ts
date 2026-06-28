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

// Product IDs are env-overridable placeholders — NEVER hardcode the FINAL store identifiers. The defaults are
// documented conventions; real IDs (which must match the App Store / Play / Stripe products) come from env at
// build time. Static `process.env.EXPO_PUBLIC_*` access so Expo/Metro can inline them. Price strings are display
// placeholders; the real LOCALIZED price comes from the billing SDK / Stripe at runtime.
export const PRICING: { monthly: PremiumPlan; yearly: PremiumPlan } = {
  monthly: { productId: process.env.EXPO_PUBLIC_PREMIUM_MONTHLY_ID || 'tpoker.premium.monthly', price: '$11.99', period: 'month' },
  yearly:  { productId: process.env.EXPO_PUBLIC_PREMIUM_YEARLY_ID  || 'tpoker.premium.yearly',  price: '$99.99', period: 'year', perMonth: '$8.33', savePct: 30 },
};

/**
 * Client-safe billing provider PUBLIC keys (RevenueCat public SDK key, Stripe publishable key). EMPTY by
 * default ⇒ the real adapters stay key-gated and the mock provider remains the active provider (OFF no-op).
 * Supply via env once accounts exist (see .env.example). These are PUBLIC keys, NOT secrets — the server-side
 * SECRET keys (Stripe secret, RevenueCat secret, webhook secrets) live ONLY on the backend, never here.
 */
export const BILLING_KEYS = {
  revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '',
  stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
};

export type PremiumFeatureKey =
  | 'premium_study'
  | 'advanced_gto' | 'ai_coach' | 'advanced_bankroll' | 'cloud_sync' | 'premium_learning';

/**
 * HONESTY: `comingSoon` marks benefits that are NOT yet live (the AI coach is a labeled demo; cloud sync,
 * advanced analytics, and premium courses are unbuilt). This is precisely why the `paywall` flag is OFF.
 * The paywall renders a "Soon" chip on these so it never presents an unshipped benefit as available. Clear
 * each flag only when the feature is genuinely live (and real billing is wired). Never charge for a `comingSoon`.
 *
 * `comingSoon` is non-optional boolean — the honesty CI guard (honesty.test.ts) checks `=== false` / `=== true`
 * so the intent is always explicit. Only `premium_study` is live (comingSoon: false).
 */
export const PREMIUM_FEATURES: { key: PremiumFeatureKey; icon: string; title: string; desc: string; comingSoon: boolean }[] = [
  { key: 'premium_study',     icon: 'library',     title: 'Premium Study',           desc: 'Full lesson library — every study pack · all quizzes · unlimited Spot Trainer', comingSoon: false },
  { key: 'ai_coach',          icon: 'sparkles',    title: 'AI Coach',                desc: '30 hand analyses every month', comingSoon: true },
  { key: 'advanced_gto',      icon: 'school',      title: 'Advanced GTO study',      desc: 'Deeper ranges, sizings & spots', comingSoon: true },
  { key: 'advanced_bankroll', icon: 'stats-chart', title: 'Advanced bankroll analytics', desc: 'Variance, filters & deeper trends', comingSoon: true },
  { key: 'cloud_sync',        icon: 'cloud-done',  title: 'Cloud sync',              desc: 'Your data, across all devices', comingSoon: true },
  { key: 'premium_learning',  icon: 'library',     title: 'Premium learning',        desc: 'Courses & guided study paths', comingSoon: true },
];
