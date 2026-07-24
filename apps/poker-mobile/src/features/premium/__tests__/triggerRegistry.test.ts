import {
  TRIGGER_REGISTRY,
  isTriggerEligible,
  shouldShowNudge,
  recordNudgeShown,
  DAY_MS,
  type NudgeShownState,
  type TriggerEligibilityCtx,
  type TriggerSurface,
} from '../triggerRegistry';
import { TRIGGER_IDS, type TriggerId } from '../triggers';

const freeCtx: TriggerEligibilityCtx = { isPremium: false, paywallOn: false, coachEnabled: false };

describe('TRIGGER_REGISTRY — completeness + honesty', () => {
  it('has exactly one entry for every trigger id (add new surfaces to the vocab AND the registry)', () => {
    const registryKeys = Object.keys(TRIGGER_REGISTRY).sort();
    expect(registryKeys).toEqual([...TRIGGER_IDS].sort());
  });

  it('every coming-soon body is honest: non-empty, "coming soon" framing, and NO price/purchase text', () => {
    for (const id of TRIGGER_IDS) {
      const { title, upgradeTitle, comingSoonBody, upgradeBody } = TRIGGER_REGISTRY[id].copy;
      expect(comingSoonBody.length).toBeGreaterThan(0);
      expect(comingSoonBody).toMatch(/coming soon/i);
      // No dollar sign / decimal price anywhere in the registry copy (titles included) — prices live
      // in PRICING, and while the paywall is OFF nothing is purchasable.
      for (const s of [title, upgradeTitle ?? '', comingSoonBody, upgradeBody]) {
        expect(s).not.toMatch(/\$/);
        expect(s).not.toMatch(/\d+\.\d{2}/);
      }
    }
  });

  it('maps each trigger id to its EXPECTED surface (a misassignment must fail loudly, not slip through eligibility)', () => {
    const EXPECTED: Record<TriggerId, TriggerSurface> = {
      trainer_daily_limit: 'trainer',
      quiz_daily_limit: 'quiz',
      study_home_library: 'study_home',
      lesson_locked: 'lessons',
      pack_detail: 'pack',
      profile_teaser: 'profile',
      profile: 'profile',
      coach_upgrade: 'coach',
      coach_no_credits: 'coach',
      coach_teaser: 'coach',
      landing_monthly: 'landing',
      landing_yearly: 'landing',
    };
    for (const id of TRIGGER_IDS) {
      expect(TRIGGER_REGISTRY[id].surface).toBe(EXPECTED[id]);
    }
  });

  it('every entry carries a surface, an icon, and a non-negative cooldown', () => {
    for (const id of TRIGGER_IDS) {
      const cfg = TRIGGER_REGISTRY[id];
      expect(cfg.surface).toBeTruthy();
      expect(cfg.copy.icon.length).toBeGreaterThan(0);
      expect(cfg.cooldownDays).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('isTriggerEligible', () => {
  it('an entitled (premium) user is never eligible for an upgrade nudge', () => {
    const premium: TriggerEligibilityCtx = { isPremium: true, paywallOn: true, coachEnabled: true };
    for (const id of TRIGGER_IDS) {
      expect(isTriggerEligible(id, premium)).toBe(false);
    }
  });

  it('coach surfaces are eligible only when the coach feature is enabled', () => {
    const coachIds = TRIGGER_IDS.filter(id => TRIGGER_REGISTRY[id].surface === 'coach');
    expect(coachIds.length).toBeGreaterThan(0);
    for (const id of coachIds) {
      expect(isTriggerEligible(id, { ...freeCtx, coachEnabled: false })).toBe(false);
      expect(isTriggerEligible(id, { ...freeCtx, coachEnabled: true })).toBe(true);
    }
  });

  it('landing (purchase-route) surfaces are eligible only when the paywall is ON', () => {
    const landingIds = TRIGGER_IDS.filter(id => TRIGGER_REGISTRY[id].surface === 'landing');
    expect(landingIds.length).toBeGreaterThan(0);
    for (const id of landingIds) {
      expect(isTriggerEligible(id, { ...freeCtx, paywallOn: false })).toBe(false);
      expect(isTriggerEligible(id, { ...freeCtx, paywallOn: true })).toBe(true);
    }
  });

  it('study/profile surfaces are eligible for a free user regardless of flags', () => {
    expect(isTriggerEligible('trainer_daily_limit', freeCtx)).toBe(true);
    expect(isTriggerEligible('study_home_library', freeCtx)).toBe(true);
    expect(isTriggerEligible('profile_teaser', freeCtx)).toBe(true);
  });
});

describe('shouldShowNudge — cooldown gate', () => {
  const t0 = 1_700_000_000_000;

  it('a cooldownDays:0 trigger always shows, even right after it was shown', () => {
    const zero = TRIGGER_IDS.find(id => TRIGGER_REGISTRY[id].cooldownDays === 0) as TriggerId;
    expect(zero).toBeDefined();
    const state: NudgeShownState = { [zero]: t0 };
    expect(shouldShowNudge(zero, state, t0)).toBe(true);
    expect(shouldShowNudge(zero, {}, t0)).toBe(true);
  });

  it('a cooldownDays>0 trigger: shows when never shown, hides within the window, shows past it', () => {
    const capped = TRIGGER_IDS.find(id => TRIGGER_REGISTRY[id].cooldownDays > 0) as TriggerId;
    expect(capped).toBeDefined();
    const days = TRIGGER_REGISTRY[capped].cooldownDays;

    expect(shouldShowNudge(capped, {}, t0)).toBe(true); // never shown
    const shown: NudgeShownState = { [capped]: t0 };
    expect(shouldShowNudge(capped, shown, t0 + days * DAY_MS - 1)).toBe(false); // one ms inside window
    expect(shouldShowNudge(capped, shown, t0 + days * DAY_MS)).toBe(true); // exactly at the window edge
  });
});

describe('recordNudgeShown — pure, composes', () => {
  it('stamps the trigger, preserves others, and does not mutate the input', () => {
    const before: NudgeShownState = { profile_teaser: 111 };
    const after = recordNudgeShown(before, 'quiz_daily_limit', 999);
    expect(after).toEqual({ profile_teaser: 111, quiz_daily_limit: 999 });
    expect(before).toEqual({ profile_teaser: 111 }); // unmutated
  });
});
