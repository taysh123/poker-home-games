import { computeXp, rankForXp, RANKS, XP_WEIGHTS } from '../xp';
import type { EngagementSignals } from '../../types';

const base: EngagementSignals = {
  spotsAnswered: 0, studyStreak: 0, studyDays: 0, bankrollSessions: 0,
  bankrollPositiveMonth: false, coachAnalyses: 0, localGamesFinished: 0,
  quizzesCompleted: 0, lessonsCompleted: 0,
};

describe('computeXp', () => {
  it('is 0 with no activity', () => {
    expect(computeXp(base, 0)).toBe(0);
  });
  it('weights each signal + achievements', () => {
    const s: EngagementSignals = { ...base, spotsAnswered: 10, studyDays: 3, bankrollSessions: 2, coachAnalyses: 1, localGamesFinished: 1 };
    const expected =
      10 * XP_WEIGHTS.spot + 3 * XP_WEIGHTS.studyDay + 2 * XP_WEIGHTS.bankrollSession +
      1 * XP_WEIGHTS.coachAnalysis + 1 * XP_WEIGHTS.localGame + 2 * XP_WEIGHTS.achievement;
    expect(computeXp(s, 2)).toBe(expected);
  });
});

describe('computeXp — MONOTONIC (Wave 0.4: XP never drops; league-math prerequisite)', () => {
  it('a breaking streak does NOT change XP — credit rides cumulative study days', () => {
    // Same 10 days of showing up; the only difference is whether the streak is currently alive.
    const alive: EngagementSignals = { ...base, studyDays: 10, studyStreak: 10 };
    const broken: EngagementSignals = { ...base, studyDays: 10, studyStreak: 0 };
    expect(computeXp(broken, 0)).toBe(computeXp(alive, 0));
  });

  it('every earned study day keeps its credit forever', () => {
    const before: EngagementSignals = { ...base, studyDays: 9 };
    const after: EngagementSignals = { ...base, studyDays: 10 };
    expect(computeXp(after, 0)).toBe(computeXp(before, 0) + XP_WEIGHTS.studyDay);
  });

  it('the volatile current streak carries NO XP weight of its own', () => {
    const noStreak: EngagementSignals = { ...base, studyDays: 5, studyStreak: 0 };
    const bigStreak: EngagementSignals = { ...base, studyDays: 5, studyStreak: 5 };
    expect(computeXp(bigStreak, 0)).toBe(computeXp(noStreak, 0));
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

describe('computeXp — quiz/lesson completion signals', () => {
  it('weights quizzesCompleted and lessonsCompleted', () => {
    const s: EngagementSignals = { ...base, quizzesCompleted: 2, lessonsCompleted: 3 };
    const expected = 2 * XP_WEIGHTS.quizCompleted + 3 * XP_WEIGHTS.lessonCompleted;
    expect(computeXp(s, 0)).toBe(expected);
  });

  it('adds completion XP on top of spot XP', () => {
    const s: EngagementSignals = { ...base, spotsAnswered: 5, quizzesCompleted: 1, lessonsCompleted: 1 };
    const expected = 5 * XP_WEIGHTS.spot + 1 * XP_WEIGHTS.quizCompleted + 1 * XP_WEIGHTS.lessonCompleted;
    expect(computeXp(s, 0)).toBe(expected);
  });
});
