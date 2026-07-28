import {
  DWELL_MS,
  INSTALL_AGE_FLOOR_MS,
  MIN_QUALIFYING_MOMENTS,
  PROMPT_COOLDOWN_MS,
  REVIEW_MOMENT_KINDS,
  STREAK_MILESTONES,
  canPresentNow,
  crossedStreakMilestone,
  evaluateReviewPrompt,
  type ReviewPromptState,
  type ReviewSignals,
} from '../reviewPromptLogic';

const DAY = 24 * 60 * 60 * 1000;
// Fixed local-component clock so expectations hold in any timezone.
const NOW = new Date(2026, 6, 28, 12, 0, 0).getTime();

function state(over: Partial<ReviewPromptState> = {}): ReviewPromptState {
  return {
    installedAt: NOW - 30 * DAY,
    moments: MIN_QUALIFYING_MOMENTS,
    streakMilestoneHigh: 0,
    lastPromptedAt: null,
    promptedVersions: [],
    countedKeys: [],
    ...over,
  };
}

function signals(over: Partial<ReviewSignals> = {}): ReviewSignals {
  return { nowMs: NOW, appVersion: '1.2.0', ...over };
}

describe('evaluateReviewPrompt — eligibility', () => {
  it('is eligible when every rule passes', () => {
    expect(evaluateReviewPrompt(state(), signals())).toEqual({ eligible: true, reason: 'ok' });
  });

  it('rejects a too-new install with reason too_new', () => {
    expect(evaluateReviewPrompt(state({ installedAt: NOW - 1 * DAY }), signals()))
      .toEqual({ eligible: false, reason: 'too_new' });
  });

  it('accepts exactly at the install-age floor (boundary)', () => {
    expect(evaluateReviewPrompt(state({ installedAt: NOW - INSTALL_AGE_FLOOR_MS }), signals()).eligible).toBe(true);
  });

  it('rejects one millisecond inside the install-age floor (boundary)', () => {
    expect(evaluateReviewPrompt(state({ installedAt: NOW - INSTALL_AGE_FLOOR_MS + 1 }), signals()))
      .toEqual({ eligible: false, reason: 'too_new' });
  });

  it('rejects too few moments with reason too_few_moments', () => {
    expect(evaluateReviewPrompt(state({ moments: MIN_QUALIFYING_MOMENTS - 1 }), signals()))
      .toEqual({ eligible: false, reason: 'too_few_moments' });
  });

  it('accepts exactly at the moment threshold (boundary)', () => {
    expect(evaluateReviewPrompt(state({ moments: MIN_QUALIFYING_MOMENTS }), signals()).eligible).toBe(true);
  });

  it('rejects a version already prompted with reason already_this_version', () => {
    expect(evaluateReviewPrompt(state({ promptedVersions: ['1.2.0'] }), signals()))
      .toEqual({ eligible: false, reason: 'already_this_version' });
  });

  it('allows a different version once the cooldown has passed', () => {
    expect(evaluateReviewPrompt(
      state({ promptedVersions: ['1.1.1'], lastPromptedAt: NOW - PROMPT_COOLDOWN_MS }),
      signals(),
    ).eligible).toBe(true);
  });

  it('rejects inside the cooldown with reason cooldown', () => {
    expect(evaluateReviewPrompt(
      state({ promptedVersions: ['1.1.1'], lastPromptedAt: NOW - 1 * DAY }),
      signals(),
    )).toEqual({ eligible: false, reason: 'cooldown' });
  });

  it('rejects one millisecond inside the cooldown (boundary)', () => {
    expect(evaluateReviewPrompt(
      state({ promptedVersions: ['1.1.1'], lastPromptedAt: NOW - PROMPT_COOLDOWN_MS + 1 }),
      signals(),
    )).toEqual({ eligible: false, reason: 'cooldown' });
  });
});

describe('crossedStreakMilestone', () => {
  it('returns null below the first milestone', () => {
    expect(crossedStreakMilestone(6, 0)).toBeNull();
  });

  it('returns 7 on the first qualifying day', () => {
    expect(crossedStreakMilestone(7, 0)).toBe(7);
  });

  it('returns null on every subsequent day until the next milestone', () => {
    // THE REGRESSION THIS EXISTS FOR: the first implementation compared the raw streak value to a
    // high-water mark, so days 8, 9, 10 … each counted. A 30-day streak produced 24 qualifying
    // moments and cleared the 3-moment gate from one signal alone.
    for (let day = 8; day < 30; day++) {
      expect(crossedStreakMilestone(day, 7)).toBeNull();
    }
  });

  it('returns 30 at the next milestone', () => {
    expect(crossedStreakMilestone(30, 7)).toBe(30);
  });

  it('returns the HIGHEST milestone crossed when several are passed at once', () => {
    expect(crossedStreakMilestone(120, 0)).toBe(100);
  });

  it('never re-counts a milestone already counted', () => {
    expect(crossedStreakMilestone(100, 100)).toBeNull();
  });

  it('does not re-award a lower milestone after a streak breaks and partly recovers', () => {
    expect(crossedStreakMilestone(7, 30)).toBeNull();
  });
});

describe('canPresentNow', () => {
  const base = { dwellElapsedMs: 7000, requiredDwellMs: 7000, isCelebrating: false };

  it('presents once the dwell is met and nothing is celebrating', () => {
    expect(canPresentNow(base)).toBe(true);
  });

  it('blocks one millisecond before the dwell elapses', () => {
    expect(canPresentNow({ ...base, dwellElapsedMs: 6999 })).toBe(false);
  });

  it('blocks while a celebration is playing', () => {
    expect(canPresentNow({ ...base, isCelebrating: true })).toBe(false);
  });
});

describe('rate-limit LITERAL pins — do not weaken', () => {
  // These assert the VALUES, not just the symbols. The first draft of this suite referenced the
  // constants (`moments: MIN_QUALIFYING_MOMENTS - 1`), so a mutation run set the moments gate to 0
  // — disabling it entirely — and all 24 tests stayed green. Rate limiting must not be dialable to
  // nothing without a test going red.
  it('requires 3 qualifying moments', () => {
    expect(MIN_QUALIFYING_MOMENTS).toBe(3);
  });

  it('holds a 3-day install floor', () => {
    expect(INSTALL_AGE_FLOOR_MS).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('holds a 90-day cooldown', () => {
    expect(PROMPT_COOLDOWN_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it('uses the [7, 30, 100] streak-milestone ladder', () => {
    expect([...STREAK_MILESTONES]).toEqual([7, 30, 100]);
  });
});

describe('honesty pins — do not weaken', () => {
  it('declares exactly the three PRODUCIBLE moment kinds', () => {
    // Every kind here has a real call site. An earlier draft also declared
    // 'achievement_dismissed', which nothing ever produced — three shipped documents claimed a
    // capability that did not exist. The vocabulary now matches what ships.
    expect([...REVIEW_MOMENT_KINDS].sort()).toEqual([
      'drill_strong',
      'game_summary',
      'streak_milestone',
    ]);
  });

  it('gives every declared moment kind a dwell', () => {
    for (const kind of REVIEW_MOMENT_KINDS) {
      expect(typeof DWELL_MS[kind]).toBe('number');
    }
    expect(Object.keys(DWELL_MS).sort()).toEqual([...REVIEW_MOMENT_KINDS].sort());
  });

  it('carries no win/loss streak signal — only the study-day streak may qualify', () => {
    // The server win/loss streak can be NEGATIVE ("3-game loss streak"); asking for a rating
    // mid-losing-streak is the failure this prevents.
    //
    // This is a TYPE-level pin, deliberately. The previous version inspected Object.keys() of the
    // test's own factory, which a mutation run defeated by adding an OPTIONAL field — it compiled
    // and passed. `Record<keyof ReviewSignals, true>` requires an entry for every key including
    // optional ones, so adding any field to ReviewSignals fails `tsc` right here.
    const SIGNAL_KEYS: Record<keyof ReviewSignals, true> = { nowMs: true, appVersion: true };
    expect(Object.keys(SIGNAL_KEYS).sort()).toEqual(['appVersion', 'nowMs']);
  });

  it('clears the ~5.04s game-end celebration before asking', () => {
    expect(DWELL_MS.game_summary).toBeGreaterThan(5040);
  });
});
