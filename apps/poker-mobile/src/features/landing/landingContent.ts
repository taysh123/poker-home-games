import type React from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { PRICING, PREMIUM_FEATURES } from '../premium/config';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type LandingValueProp = { icon: IoniconName; title: string; body: string };
export type LandingPlan = {
  key: 'monthly' | 'yearly';
  productId: string;
  price: string;
  cadence: string;
  subline?: string;
  highlighted: boolean;
};
export type LandingBenefit = { title: string; comingSoon: boolean };
export type LandingFaq = { q: string; a: string };
export type LandingLegalLink = { label: string; href: string };

/** The ONE live paid benefit — verbatim from §7 / features/premium/config.ts. */
export const PREMIUM_STUDY_BENEFIT =
  'Full lesson library — every study pack · all quizzes · unlimited Spot Trainer';

export const LANDING_HERO = {
  headline: 'Run the night. Settle in one tap.',
  subhead:
    'T Poker is the free home-game club tool — cash games and tournaments, ' +
    'buy-ins, a blind clock, and instant settlements. No account needed to start.',
  primaryCta: 'Start a free game',
  secondaryCta: 'See Premium',
};

/** Free club tool — the differentiator / acquisition hook. */
export const LANDING_CLUB_VALUE: LandingValueProp[] = [
  {
    icon: 'play-circle',
    title: 'Cash & tournaments',
    body: 'Track every buy-in and cash-out, or run a tournament with a blind clock and prize pool.',
  },
  {
    icon: 'people',
    title: 'Built for your crew',
    body: 'Groups, lifetime stats, leaderboards, and head-to-head — your regular game, organized.',
  },
  {
    icon: 'flash',
    title: 'One-tap settlements',
    body: 'We do the debt math. Everyone knows who owes who the moment the night ends.',
  },
];

/** Get better between sessions — Premium Study. */
export const LANDING_STUDY_VALUE: LandingValueProp[] = [
  {
    icon: 'school',
    title: 'Study packs',
    body: 'Structured lessons on cash, tournaments, push/fold, and the mental game.',
  },
  {
    icon: 'help-circle',
    title: 'Daily quizzes',
    body: 'Quick reps that build a streak — free every day, unlimited with Premium.',
  },
  {
    icon: 'locate',
    title: 'Spot Trainer',
    body: 'Drill real preflop spots until the right play is automatic.',
  },
];

export function landingPlans(): LandingPlan[] {
  return [
    {
      key: 'monthly',
      productId: PRICING.monthly.productId,
      price: PRICING.monthly.price,
      cadence: 'per month',
      highlighted: false,
    },
    {
      key: 'yearly',
      productId: PRICING.yearly.productId,
      price: PRICING.yearly.price,
      cadence: 'per year',
      subline: `${PRICING.yearly.perMonth}/mo · save ${PRICING.yearly.savePct}%`,
      highlighted: true,
    },
  ];
}

/**
 * Pricing-card benefit list. Premium Study is the only live (purchasable) value;
 * every other premium feature is shown honestly with a Soon chip and no buy path.
 * Sourced from PREMIUM_FEATURES when available (drops premium_study, which we lead
 * with explicitly, and never advertises Advanced GTO / PACK-10). Falls back to a
 * static honest list if the catalog has not yet been extended.
 */
export function landingBenefits(): LandingBenefit[] {
  const soonFromCatalog = PREMIUM_FEATURES
    .filter(f => f.key !== 'premium_study' && f.comingSoon)
    .filter(f => !/advanced gto/i.test(f.title))
    .map(f => ({ title: f.title, comingSoon: true as const }));

  const soon: LandingBenefit[] = soonFromCatalog.length
    ? soonFromCatalog
    : [
        { title: 'AI Coach', comingSoon: true },
        { title: 'Advanced bankroll analytics', comingSoon: true },
        { title: 'Cloud sync', comingSoon: true },
      ];

  return [{ title: PREMIUM_STUDY_BENEFIT, comingSoon: false }, ...soon];
}

export const LANDING_FAQ: LandingFaq[] = [
  {
    q: 'Is the home-game tool really free?',
    a: 'Yes. Running cash games and tournaments, settlements, groups, and stats are free — no account required to start.',
  },
  {
    q: 'What does Premium include today?',
    a: `${PREMIUM_STUDY_BENEFIT}. Other premium features are marked "Soon" and are never charged for until they ship.`,
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes — subscriptions renew until cancelled, and you can cancel anytime from your account.',
  },
  {
    q: 'Is this real-money gambling?',
    a: 'No. T Poker is a tracking and study tool for private home games. It handles no wagers and involves no real-money betting.',
  },
];

export const LANDING_LEGAL_LINKS: LandingLegalLink[] = [
  { label: 'Privacy', href: '/privacy.html' },
  { label: 'Terms', href: '/terms.html' },
];

export const LANDING_DISCLAIMER = '18+ · not a gambling product';
