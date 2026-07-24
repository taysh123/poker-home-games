/**
 * Central trigger registry (E.1) — the single source of truth for every honest upgrade surface,
 * keyed by the stable `TriggerId` vocabulary (`triggers.ts`, Wave 0.2). Each entry carries the
 * surface's copy, icon, eligibility rule, and frequency cap.
 *
 * PURE CORE ONLY (owner decision 2026-07-24): this module is data + pure functions. It is NOT yet
 * wired into any screen — `LockNudge` / Profile / Lessons still pass copy as props, and the
 * migration to read FROM this registry (plus the new visual nudge surfaces) is a later, visual
 * slice held with 2.2 until the resubmission clears. The copy here mirrors the current call-site
 * copy so that migration is behavior-preserving.
 *
 * HONESTY: while the `paywall` flag is OFF nothing is purchasable — every `comingSoonBody` reads as
 * "coming soon" and NO copy here contains a price (prices live in `config.ts` PRICING). Pinned by
 * `triggerRegistry.test.ts`.
 */
import type { TriggerId } from './triggers';

/** Where a trigger lives — drives eligibility (coach/landing are feature/flag-gated). */
export type TriggerSurface =
  | 'trainer'
  | 'quiz'
  | 'study_home'
  | 'lessons'
  | 'pack'
  | 'profile'
  | 'coach'
  | 'landing';

export interface TriggerCopy {
  /** Title shown while the paywall is OFF (the honest "coming soon" state). */
  title: string;
  /** Optional title when the paywall is ON (purchase state); falls back to `title`. */
  upgradeTitle?: string;
  /** Body shown while the paywall is OFF — MUST be honest (no price, no purchase path). */
  comingSoonBody: string;
  /** Body shown above the CTA when the paywall is ON. */
  upgradeBody: string;
  /** Ionicons name for the surface's icon. */
  icon: string;
}

export interface TriggerConfig {
  surface: TriggerSurface;
  copy: TriggerCopy;
  /**
   * Minimum whole days between showing this nudge to the same user. `0` = show on every eligible
   * impression (informational limits / contextual locks). Values are product-tunable at migration.
   */
  cooldownDays: number;
}

export const TRIGGER_REGISTRY: Record<TriggerId, TriggerConfig> = {
  trainer_daily_limit: {
    surface: 'trainer',
    cooldownDays: 0, // informational — show whenever the user hits the daily practice cap
    copy: {
      title: 'Daily free limit reached',
      comingSoonBody: 'Daily free limit reached — resets at midnight. Unlimited practice is coming soon.',
      upgradeBody: "You've used today's free practice questions. Go unlimited with Premium.",
      icon: 'time-outline',
    },
  },
  quiz_daily_limit: {
    surface: 'quiz',
    cooldownDays: 0,
    copy: {
      title: 'Daily free limit reached',
      comingSoonBody: 'Daily free limit reached — resets tomorrow. Premium (unlimited) coming soon.',
      upgradeBody: "You've used today's free quiz. Go unlimited with Premium.",
      icon: 'time-outline',
    },
  },
  study_home_library: {
    surface: 'study_home',
    cooldownDays: 3, // teaser — don't nag on every visit to the study home
    copy: {
      title: 'More packs on the way',
      upgradeTitle: 'Unlock the full library',
      comingSoonBody: 'The 4 free packs are open now. Premium unlocks the full library — coming soon.',
      upgradeBody: 'Unlock every study pack, all quizzes, and unlimited Spot Trainer.',
      icon: 'library-outline',
    },
  },
  lesson_locked: {
    surface: 'lessons',
    cooldownDays: 3,
    copy: {
      title: 'More lessons on the way',
      upgradeTitle: 'Unlock every lesson',
      comingSoonBody: 'The free lessons are open now. More lessons are coming soon.',
      upgradeBody: 'Unlock every lesson with Premium.',
      icon: 'book-outline',
    },
  },
  pack_detail: {
    surface: 'pack',
    cooldownDays: 0, // contextual — the user opened a premium pack
    copy: {
      title: 'Premium pack',
      comingSoonBody: 'Premium is coming soon. The free packs are open now.',
      upgradeBody: 'Unlock this pack with Premium.',
      icon: 'lock-closed',
    },
  },
  profile_teaser: {
    surface: 'profile',
    cooldownDays: 7, // low-priority teaser row
    copy: {
      title: 'Premium',
      comingSoonBody: "Premium is coming soon — see what's planned.",
      upgradeBody: 'See what Premium unlocks.',
      icon: 'sparkles-outline',
    },
  },
  profile: {
    surface: 'profile',
    cooldownDays: 0, // a static card in Profile — presence isn't naggy
    copy: {
      title: 'Cloud Sync',
      comingSoonBody: 'Cloud sync is coming soon — your data is safe on this device meanwhile.',
      upgradeBody: 'Back up and sync across devices with Premium.',
      icon: 'cloud-outline',
    },
  },
  coach_upgrade: {
    surface: 'coach',
    cooldownDays: 1,
    copy: {
      title: 'AI Coach',
      comingSoonBody: 'AI Coach is coming soon.',
      upgradeBody: 'Unlock AI Coach with Premium.',
      icon: 'chatbubbles-outline',
    },
  },
  coach_no_credits: {
    surface: 'coach',
    cooldownDays: 0, // contextual — the user just ran out of credits
    copy: {
      title: 'Out of credits',
      comingSoonBody: 'AI Coach is coming soon.',
      upgradeBody: 'Get more coach credits with Premium.',
      icon: 'flash-outline',
    },
  },
  coach_teaser: {
    surface: 'coach',
    cooldownDays: 7,
    copy: {
      title: 'Meet your AI Coach',
      comingSoonBody: 'AI Coach is coming soon — a study companion that explains every spot.',
      upgradeBody: 'Meet your AI Coach with Premium.',
      icon: 'chatbubbles-outline',
    },
  },
  landing_monthly: {
    surface: 'landing',
    cooldownDays: 0, // a web CTA, not a naggy in-app nudge (also paywall-gated)
    copy: {
      title: 'Premium monthly',
      comingSoonBody: 'Premium is coming soon.',
      upgradeBody: 'Go Premium, billed monthly.',
      icon: 'card-outline',
    },
  },
  landing_yearly: {
    surface: 'landing',
    cooldownDays: 0,
    copy: {
      title: 'Premium yearly',
      comingSoonBody: 'Premium is coming soon.',
      upgradeBody: 'Go Premium, billed yearly.',
      icon: 'card-outline',
    },
  },
};

/** Pure inputs for eligibility — the caller supplies current app state. */
export interface TriggerEligibilityCtx {
  /** Already entitled → never show an upgrade nudge. */
  isPremium: boolean;
  /** `config/features` paywall flag (OFF in prod today). */
  paywallOn: boolean;
  /** `config/features` coach flag (OFF in prod today). */
  coachEnabled: boolean;
}

/**
 * Whether a trigger's surface is allowed to show at all, given app state. This is the HIGH-LEVEL
 * gate (entitlement + feature flags); the per-limit precondition (e.g. "daily cap reached") stays
 * at the call site. Honest by construction: coach surfaces need the coach feature; landing (purchase
 * route) surfaces need the paywall on — both OFF in prod, so neither shows.
 */
export function isTriggerEligible(id: TriggerId, ctx: TriggerEligibilityCtx): boolean {
  if (ctx.isPremium) return false;
  const { surface } = TRIGGER_REGISTRY[id];
  if (surface === 'coach') return ctx.coachEnabled;
  if (surface === 'landing') return ctx.paywallOn;
  return true;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Last-shown epoch-ms per trigger. Sparse — an absent key means "never shown". */
export type NudgeShownState = Partial<Record<TriggerId, number>>;

/**
 * Frequency-cap gate (pure): true when the cooldown has elapsed since the last show, or the trigger
 * was never shown, or its cooldown is 0. Compose with `isTriggerEligible` at the call site.
 */
export function shouldShowNudge(id: TriggerId, state: NudgeShownState, nowMs: number): boolean {
  const { cooldownDays } = TRIGGER_REGISTRY[id];
  if (cooldownDays <= 0) return true;
  const last = state[id];
  if (last == null) return true;
  return nowMs - last >= cooldownDays * DAY_MS;
}

/** Record that a nudge was shown; returns a NEW state (pure — compose, never mutate in place). */
export function recordNudgeShown(state: NudgeShownState, id: TriggerId, nowMs: number): NudgeShownState {
  return { ...state, [id]: nowMs };
}
