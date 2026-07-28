import {
  DWELL_MS,
  INSTALL_AGE_FLOOR_MS,
  MIN_QUALIFYING_MOMENTS,
  PROMPT_COOLDOWN_MS,
  REVIEW_MOMENT_KINDS,
  SHEET_OCCLUSION_H,
  canPresentNow,
  evaluateReviewPrompt,
  regionState,
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
    lastSentiment: null,
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
    const r = evaluateReviewPrompt(state({ installedAt: NOW - 1 * DAY }), signals());
    expect(r).toEqual({ eligible: false, reason: 'too_new' });
  });

  it('accepts exactly at the install-age floor (boundary)', () => {
    const r = evaluateReviewPrompt(state({ installedAt: NOW - INSTALL_AGE_FLOOR_MS }), signals());
    expect(r.eligible).toBe(true);
  });

  it('rejects too few moments with reason too_few_moments', () => {
    const r = evaluateReviewPrompt(state({ moments: MIN_QUALIFYING_MOMENTS - 1 }), signals());
    expect(r).toEqual({ eligible: false, reason: 'too_few_moments' });
  });

  it('accepts exactly at the moment threshold (boundary)', () => {
    expect(evaluateReviewPrompt(state({ moments: MIN_QUALIFYING_MOMENTS }), signals()).eligible).toBe(true);
  });

  it('rejects a version already prompted with reason already_this_version', () => {
    const r = evaluateReviewPrompt(state({ promptedVersions: ['1.2.0'] }), signals());
    expect(r).toEqual({ eligible: false, reason: 'already_this_version' });
  });

  it('allows a different version once the cooldown has passed', () => {
    const r = evaluateReviewPrompt(
      state({ promptedVersions: ['1.1.1'], lastPromptedAt: NOW - PROMPT_COOLDOWN_MS }),
      signals(),
    );
    expect(r.eligible).toBe(true);
  });

  it('rejects inside the cooldown with reason cooldown', () => {
    const r = evaluateReviewPrompt(
      state({ promptedVersions: ['1.1.1'], lastPromptedAt: NOW - 1 * DAY }),
      signals(),
    );
    expect(r).toEqual({ eligible: false, reason: 'cooldown' });
  });

  it('suppresses an unhappy user for the rest of the cooldown', () => {
    const r = evaluateReviewPrompt(
      state({ promptedVersions: ['1.1.1'], lastPromptedAt: NOW - 10 * DAY, lastSentiment: 'unhappy' }),
      signals(),
    );
    expect(r.eligible).toBe(false);
  });
});

describe('regionState — settlement geometry', () => {
  const viewportH = 800;
  const sheetH = SHEET_OCCLUSION_H;
  const sheetTop = viewportH - sheetH;

  it('reports a block sitting entirely above the sheet as fully visible and not intersecting', () => {
    expect(regionState({ top: 100, bottom: sheetTop - 10, viewportH, sheetH })).toEqual({
      fullyVisibleAboveSheet: true,
      intersectsSheet: false,
    });
  });

  it('reports a block straddling the sheet edge as intersecting', () => {
    const r = regionState({ top: sheetTop - 20, bottom: sheetTop + 20, viewportH, sheetH });
    expect(r.intersectsSheet).toBe(true);
    expect(r.fullyVisibleAboveSheet).toBe(false);
  });

  it('does not treat a block scrolled off the top as intersecting', () => {
    expect(regionState({ top: -400, bottom: -100, viewportH, sheetH })).toEqual({
      fullyVisibleAboveSheet: false,
      intersectsSheet: false,
    });
  });

  it('does not treat a block below the fold as visible', () => {
    const r = regionState({ top: viewportH + 50, bottom: viewportH + 300, viewportH, sheetH });
    expect(r.fullyVisibleAboveSheet).toBe(false);
    expect(r.intersectsSheet).toBe(false);
  });

  it('handles a short summary where the block sits high on screen', () => {
    expect(regionState({ top: 40, bottom: 240, viewportH, sheetH }).fullyVisibleAboveSheet).toBe(true);
  });
});

describe('canPresentNow', () => {
  const base = {
    dwellElapsedMs: DWELL_MS.game_summary,
    requiredDwellMs: DWELL_MS.game_summary,
    isCelebrating: false,
    protectedRegion: { seen: true, intersectsSheet: false },
  };

  it('presents when dwell is met, nothing is celebrating, and the region is seen and clear', () => {
    expect(canPresentNow(base)).toBe(true);
  });

  it('blocks before the dwell elapses', () => {
    expect(canPresentNow({ ...base, dwellElapsedMs: DWELL_MS.game_summary - 1 })).toBe(false);
  });

  it('blocks while a celebration is playing', () => {
    expect(canPresentNow({ ...base, isCelebrating: true })).toBe(false);
  });

  it('blocks when the protected region has never been seen', () => {
    expect(canPresentNow({ ...base, protectedRegion: { seen: false, intersectsSheet: false } })).toBe(false);
  });

  it('blocks when the protected region would be covered right now', () => {
    expect(canPresentNow({ ...base, protectedRegion: { seen: true, intersectsSheet: true } })).toBe(false);
  });

  it('needs only dwell on a surface with no protected region', () => {
    expect(canPresentNow({
      dwellElapsedMs: DWELL_MS.drill_results,
      requiredDwellMs: DWELL_MS.drill_results,
      isCelebrating: false,
      protectedRegion: null,
    })).toBe(true);
  });
});

describe('honesty pins — do not weaken', () => {
  it('produces exactly the four approved moment kinds', () => {
    expect([...REVIEW_MOMENT_KINDS].sort()).toEqual([
      'achievement_dismissed',
      'drill_strong',
      'game_summary',
      'streak_milestone',
    ]);
  });

  it('carries no win/loss streak signal — only the study-day streak may qualify', () => {
    // The server win/loss streak can be NEGATIVE ("3-game loss streak"). Asking for a rating
    // mid-losing-streak is the exact failure this pin exists to prevent. Making it
    // unrepresentable beats documenting it.
    const keys = Object.keys(signals()).sort();
    expect(keys).toEqual(['appVersion', 'nowMs']);
  });

  it('gives the game summary a longer dwell than drill results', () => {
    expect(DWELL_MS.game_summary).toBeGreaterThan(DWELL_MS.drill_results);
  });

  it('clears the ~5.04s game-end celebration on the summary surface', () => {
    expect(DWELL_MS.game_summary).toBeGreaterThan(5040);
  });
});
