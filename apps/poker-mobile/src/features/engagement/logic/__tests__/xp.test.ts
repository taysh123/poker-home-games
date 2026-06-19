import { computeXp, rankForXp, RANKS, XP_WEIGHTS } from '../xp';
import type { EngagementSignals } from '../../types';

const base: EngagementSignals = {
  spotsAnswered: 0, studyStreak: 0, bankrollSessions: 0,
  bankrollPositiveMonth: false, coachAnalyses: 0, localGamesFinished: 0,
};

describe('computeXp', () => {
  it('is 0 with no activity', () => {
    expect(computeXp(base, 0)).toBe(0);
  });
  it('weights each signal + achievements', () => {
    const s: EngagementSignals = { ...base, spotsAnswered: 10, studyStreak: 3, bankrollSessions: 2, coachAnalyses: 1, localGamesFinished: 1 };
    const expected =
      10 * XP_WEIGHTS.spot + 3 * XP_WEIGHTS.streakDay + 2 * XP_WEIGHTS.bankrollSession +
      1 * XP_WEIGHTS.coachAnalysis + 1 * XP_WEIGHTS.localGame + 2 * XP_WEIGHTS.achievement;
    expect(computeXp(s, 2)).toBe(expected);
  });
});

describe('rankForXp', () => {
  it('returns the first rank at 0 xp with progress toward the next', () => {
    const r = rankForXp(0);
    expect(r.rank.name).toBe('Rounder');
    expect(r.next?.name).toBe('Reg');
    expect(r.progressPct).toBe(0);
  });
  it('advances rank as xp crosses thresholds', () => {
    expect(rankForXp(250).rank.name).toBe('Reg');
    expect(rankForXp(749).rank.name).toBe('Reg');
    expect(rankForXp(750).rank.name).toBe('Grinder');
  });
  it('caps at the top rank with full progress', () => {
    const top = RANKS[RANKS.length - 1];
    const r = rankForXp(top.min + 9999);
    expect(r.rank.name).toBe(top.name);
    expect(r.next).toBeNull();
    expect(r.progressPct).toBe(1);
  });
  it('progress is 0..1 within a band', () => {
    const r = rankForXp(500); // between Reg(250) and Grinder(750)
    expect(r.progressPct).toBeCloseTo((500 - 250) / (750 - 250), 5);
  });
});
