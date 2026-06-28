import { SITE } from './site';

/**
 * Honesty model — the SINGLE source of truth for what is actually purchasable.
 *
 * Exactly ONE premium benefit is live today: Premium Study. Everything else is
 * genuinely "coming soon" and MUST NOT carry a `buyHref` (the UI only renders a
 * buy CTA when `feature.live && feature.buyHref`). This file is pinned by
 * `__tests__/honesty.test.ts` so we can never accidentally sell vapor.
 */
export type PremiumFeature = {
  key: string;
  title: string;
  desc: string;
  live: boolean;
  /** Present ONLY for live features. Coming-soon entries must omit this. */
  buyHref?: string;
};

export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    key: 'premium_study',
    title: 'Premium Study',
    desc: 'Full lesson library — every study pack, all quizzes, unlimited Spot Trainer.',
    live: true,
    buyHref: SITE.appUrl,
  },
  {
    key: 'ai_coach',
    title: 'AI Coach',
    desc: 'Personalized feedback on your sessions — your hands, your leaks, your next move.',
    live: false,
  },
  {
    key: 'cloud_sync',
    title: 'Cloud Sync',
    desc: 'Your games and progress, backed up and in sync across every device.',
    live: false,
  },
  {
    key: 'advanced_bankroll',
    title: 'Advanced Bankroll Analytics',
    desc: 'Deeper bankroll trends, variance insight, and goal tracking over time.',
    live: false,
  },
];

/** The features that are actually purchasable right now. */
export const liveFeatures = (): PremiumFeature[] =>
  PREMIUM_FEATURES.filter((f) => f.live);

/** The honest "coming soon" set — never shown with a buy CTA. */
export const comingSoonFeatures = (): PremiumFeature[] =>
  PREMIUM_FEATURES.filter((f) => !f.live);
