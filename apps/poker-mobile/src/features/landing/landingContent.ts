import type React from 'react';
import type { Ionicons } from '@expo/vector-icons';
import { PRICING, PREMIUM_FEATURES, type PremiumFeatureKey } from '../premium/config';
import type { LandingImageKey } from './landingImages';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Ambient-only section accents (approved 2026-07-06): eyebrow text + media glow. */
export type LandingAccent = 'gold' | 'felt' | 'teal' | 'purple';

export type LandingValueProp = { icon: IoniconName; title: string; body: string };
export type LandingSection = {
  key: string;
  eyebrow: string;
  heading: string;
  body: string;
  image: LandingImageKey;
  /** Accessible description of the screenshot for screen readers / axe alt-text. */
  imageAlt: string;
  accent: LandingAccent;
  /**
   * Ties the section to the premium honesty catalog: the section chip renders
   * live-vs-Soon from isFeatureLive(featureKey) at render time, so the page is
   * truthful in every posture and flips automatically with the launch honesty flip.
   */
  featureKey?: PremiumFeatureKey;
};
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
  headline: 'Your home game, handled.',
  subhead:
    "Track buy-ins, settle up instantly, and crown your crew's champion — " +
    'free, no account needed.',
  primaryCta: 'Start a free game',
  secondaryCta: 'Sign in',
};

/**
 * Always visible directly under the hero CTAs — truthful positioning is part of
 * the brand (and of the Paddle/store review posture). Never bury or remove it.
 */
export const LANDING_TRUST_LINE = 'Free for your home game · 18+ · Not a gambling product.';

/**
 * One idea per section, GTO-Wizard rhythm: eyebrow → big heading → 1–2 lines →
 * large real product screenshot (landingImages). Order = page order = anchor nav.
 */
export const LANDING_SECTIONS: LandingSection[] = [
  {
    key: 'live',
    eyebrow: 'LIVE GAME',
    heading: 'Run the table in real time.',
    body: 'Buy-ins, cash-outs, and the pot — tracked as they happen. No spreadsheets.',
    image: 'liveCash',
    imageAlt: 'Live cash game screen: felt table with four seated players, their stacks, and a ₪250 pot',
    accent: 'felt',
  },
  {
    key: 'settle',
    eyebrow: 'SETTLE UP',
    heading: 'Everyone leaves square.',
    body: 'Count the chips once — we compute exactly who pays who.',
    image: 'settle',
    imageAlt: 'Game-over summary: ranked results with profit and loss, and the cash settlements list of who pays who',
    accent: 'gold',
  },
  {
    key: 'tournament',
    eyebrow: 'TOURNAMENT MODE',
    heading: 'Host it like a tournament director.',
    body: 'Blind clock, prize pool, payouts, podium — the full tournament on one phone.',
    image: 'tournament',
    imageAlt: 'Live tournament dashboard: prize pool, level 1 blinds 25/50, countdown clock, players left and average stack',
    accent: 'gold',
  },
  {
    key: 'stats',
    eyebrow: 'KNOW YOUR NUMBERS',
    heading: 'Your poker story, in numbers.',
    body: 'Results, streaks and stats for every game — free on this device, lifetime with a free account.',
    image: 'stats',
    imageAlt: 'Stats screen: games played, money on the table, biggest win, and recent results with winners',
    accent: 'teal',
  },
  {
    key: 'study',
    eyebrow: 'STUDY',
    heading: 'A real curriculum, not tips.',
    body: 'Seventeen structured packs — cash, MTT, ICM, the mental game — built like a course.',
    image: 'studyLibrary',
    imageAlt: 'Content pack catalog: a curriculum of structured study packs with difficulty tiers, estimated hours, and premium locks',
    accent: 'teal',
    featureKey: 'premium_study',
  },
  {
    key: 'trainer',
    eyebrow: 'PRACTICE',
    heading: "Drill it until it's automatic.",
    body: 'Real preflop spots on a real table — instant feedback, honest ranges.',
    image: 'spotTrainer',
    imageAlt: 'Spot Trainer: a poker table scene asking button first-in open or fold, with hole cards and a correct-answer feedback card',
    accent: 'felt',
  },
  {
    // COPY GUARDRAIL (locked positioning): after-the-fact educational hand review,
    // "expert-calibrated" — NEVER "solver-verified"/"GTO-exact", never live advice.
    key: 'coach',
    eyebrow: 'AI COACH',
    heading: 'Review the hand. Learn the lesson.',
    body: 'Paste a hand after the game and get expert-calibrated coaching — mistakes, good decisions, better lines. Educational review — never live in-game advice.',
    image: 'aiCoach',
    imageAlt: 'AI Coach hand review: summary of ace-king from the button with street-tagged mistakes and good decisions',
    accent: 'purple',
    featureKey: 'ai_coach',
  },
];

/** Premium bridge section (leads into pricing). */
export const LANDING_PREMIUM = {
  eyebrow: 'PREMIUM',
  heading: 'Sharpen your edge between games.',
};

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
 * Pricing-card benefit list — a FULL passthrough of the premium catalog, live-first.
 *
 * Posture-agnostic by construction: `comingSoon` flows straight from
 * PREMIUM_FEATURES (the honesty config the launch "honesty flip" edits), so the
 * same code truthfully renders 1-live/3-Soon today and all-live post-flip with
 * ZERO landing edits. (The previous version FILTERED on comingSoon===true, which
 * made newly-live features silently vanish from the page after the flip.)
 * Advanced GTO / PACK-10 is never advertised as paid value (blocklist).
 */
export function landingBenefits(): LandingBenefit[] {
  return [...PREMIUM_FEATURES]
    .filter(f => !/advanced gto/i.test(f.title))
    .sort((a, b) => Number(a.comingSoon) - Number(b.comingSoon))
    .map(f => ({
      title: f.key === 'premium_study' ? PREMIUM_STUDY_BENEFIT : f.title,
      comingSoon: f.comingSoon,
    }));
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
  {
    q: 'Does the AI Coach give live advice during hands?',
    a: 'No. The AI Coach is an after-the-fact educational review tool — you paste a hand you already played and get expert-calibrated coaching on it. It never advises during live play.',
  },
];

export const LANDING_LEGAL_LINKS: LandingLegalLink[] = [
  { label: 'Privacy', href: '/privacy.html' },
  { label: 'Terms', href: '/terms.html' },
];

export const LANDING_DISCLAIMER = '18+ · not a gambling product';
