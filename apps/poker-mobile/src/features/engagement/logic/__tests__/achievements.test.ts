import { LOCAL_ACHIEVEMENTS, eligibleKeys, evaluate, findAchievement } from '../achievements';
import type { EngagementSignals } from '../../types';

const base: EngagementSignals = {
  spotsAnswered: 0, studyStreak: 0, studyDays: 0, bankrollSessions: 0,
  bankrollPositiveMonth: false, coachAnalyses: 0, localGamesFinished: 0,
  quizzesCompleted: 0, lessonsCompleted: 0,
};

describe('achievement eligibility', () => {
  it('unlocks first-tier pillar achievements on first action', () => {
    expect(eligibleKeys({ ...base, spotsAnswered: 1 })).toContain('study_first');
    expect(eligibleKeys({ ...base, bankrollSessions: 1 })).toContain('bankroll_first');
    expect(eligibleKeys({ ...base, coachAnalyses: 1 })).toContain('coach_first');
    expect(eligibleKeys({ ...base, localGamesFinished: 1 })).toContain('play_first');
  });
  it('respects higher thresholds', () => {
    expect(eligibleKeys({ ...base, spotsAnswered: 99 })).not.toContain('study_century');
    expect(eligibleKeys({ ...base, spotsAnswered: 100 })).toContain('study_century');
    expect(eligibleKeys({ ...base, studyStreak: 7 })).toContain('study_streak_7');
  });
});

describe('evaluate (newly unlocked = eligible − seen)', () => {
  it('returns only keys not already seen', () => {
    const s: EngagementSignals = { ...base, spotsAnswered: 1, coachAnalyses: 1 };
    expect(evaluate(s, {})).toEqual(expect.arrayContaining(['study_first', 'coach_first']));
    const seen = { study_first: '2026-06-20T00:00:00.000Z' };
    const newly = evaluate(s, seen);
    expect(newly).toContain('coach_first');
    expect(newly).not.toContain('study_first');
  });
});

describe('catalog integrity', () => {
  it('has unique keys + valid rarities', () => {
    const keys = LOCAL_ACHIEVEMENTS.map(a => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    const rarities = new Set(['Common', 'Rare', 'Epic', 'Legendary']);
    expect(LOCAL_ACHIEVEMENTS.every(a => rarities.has(a.rarity))).toBe(true);
  });
  it('findAchievement resolves by key', () => {
    expect(findAchievement('coach_ten')?.name).toBe('Student of the Game');
    expect(findAchievement('nope')).toBeUndefined();
  });
});
