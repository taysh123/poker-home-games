import {
  emptyProgress, recordAnswer, computeStreaks, studyStats,
  setDailyGoal, computeStreaksWithFreeze, autoFreezeMissedDay, refreshFreezeTokens, isoWeekKey,
} from '../progress';

describe('recordAnswer', () => {
  it('increments totals and per-day counts', () => {
    let p = emptyProgress();
    p = recordAnswer(p, true, '2026-06-18');
    p = recordAnswer(p, false, '2026-06-18');
    expect(p.totalAnswered).toBe(2);
    expect(p.totalCorrect).toBe(1);
    expect(p.dailyCounts['2026-06-18']).toBe(2);
    expect(p.lastStudyDate).toBe('2026-06-18');
  });
});

describe('computeStreaks', () => {
  it('is 0 with no activity', () => {
    expect(computeStreaks({}, '2026-06-18')).toEqual({ current: 0, longest: 0 });
  });
  it('counts consecutive days ending today', () => {
    const counts = { '2026-06-16': 3, '2026-06-17': 1, '2026-06-18': 5 };
    expect(computeStreaks(counts, '2026-06-18')).toEqual({ current: 3, longest: 3 });
  });
  it('keeps the streak alive if the last study day was yesterday', () => {
    const counts = { '2026-06-16': 1, '2026-06-17': 1 };
    expect(computeStreaks(counts, '2026-06-18').current).toBe(2);
  });
  it('breaks the current streak after a missed day but keeps longest', () => {
    const counts = { '2026-06-10': 1, '2026-06-11': 1, '2026-06-12': 1, '2026-06-18': 1 };
    const r = computeStreaks(counts, '2026-06-18');
    expect(r.current).toBe(1);
    expect(r.longest).toBe(3);
  });
});

describe('studyStats', () => {
  it('reports accuracy, today count, and goal status', () => {
    let p = emptyProgress(2);
    p = recordAnswer(p, true, '2026-06-18');
    p = recordAnswer(p, true, '2026-06-18');
    const s = studyStats(p, '2026-06-18');
    expect(s.accuracyPct).toBe(100);
    expect(s.answeredToday).toBe(2);
    expect(s.goalMetToday).toBe(true);
  });
  it('null accuracy before any answers', () => {
    expect(studyStats(emptyProgress(), '2026-06-18').accuracyPct).toBeNull();
  });
});

// ── STEP 3.1 — daily goal customization ──
describe('setDailyGoal', () => {
  it('sets a goal within range', () => {
    expect(setDailyGoal(emptyProgress(), 5).dailyGoal).toBe(5);
  });
  it('clamps below 3 and above 25', () => {
    expect(setDailyGoal(emptyProgress(), 1).dailyGoal).toBe(3);
    expect(setDailyGoal(emptyProgress(), 99).dailyGoal).toBe(25);
  });
});

// ── STEP 3.1 — streak freeze ──
describe('computeStreaksWithFreeze', () => {
  it('matches computeStreaks when there are no frozen days', () => {
    const counts = { '2026-06-16': 3, '2026-06-17': 1, '2026-06-18': 5 };
    expect(computeStreaksWithFreeze(counts, '2026-06-18', [])).toEqual(computeStreaks(counts, '2026-06-18'));
  });
  it('bridges a single missed day that is frozen', () => {
    // Studied 16th + 18th, missed 17th, but 17th is frozen → continuous run of 3.
    const counts = { '2026-06-16': 1, '2026-06-18': 1 };
    const r = computeStreaksWithFreeze(counts, '2026-06-18', ['2026-06-17']);
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
  });
});

describe('autoFreezeMissedDay', () => {
  it('freezes yesterday when it was the only missed day and a token is available', () => {
    // Last studied = day before yesterday (16th), today = 18th, yesterday (17th) missed.
    let p = emptyProgress();
    p = recordAnswer(p, true, '2026-06-16');
    p = { ...p, freezeTokens: 1 };
    const next = autoFreezeMissedDay(p, '2026-06-18');
    expect(next.frozenDays).toContain('2026-06-17');
    expect(next.freezeTokens).toBe(0);
    // The streak is now alive through today's eventual study.
    expect(computeStreaksWithFreeze({ ...next.dailyCounts }, '2026-06-18', next.frozenDays ?? []).current).toBe(2);
  });
  it('does nothing without a token', () => {
    let p = recordAnswer(emptyProgress(), true, '2026-06-16');
    p = { ...p, freezeTokens: 0 };
    expect(autoFreezeMissedDay(p, '2026-06-18')).toEqual(p);
  });
  it('does nothing when more than one day was missed', () => {
    let p = recordAnswer(emptyProgress(), true, '2026-06-14');
    p = { ...p, freezeTokens: 1 };
    expect(autoFreezeMissedDay(p, '2026-06-18')).toEqual(p); // 3-day gap — freeze cannot bridge
  });
});

describe('refreshFreezeTokens', () => {
  it('refills to max on a new ISO week and is idempotent within the week', () => {
    let p = emptyProgress();
    p = refreshFreezeTokens(p, '2026-06-15', 1); // Monday
    expect(p.freezeTokens).toBe(1);
    p = { ...p, freezeTokens: 0 };
    p = refreshFreezeTokens(p, '2026-06-17', 1); // same week → no refill
    expect(p.freezeTokens).toBe(0);
    p = refreshFreezeTokens(p, '2026-06-22', 2); // next week → refill to max (premium 2)
    expect(p.freezeTokens).toBe(2);
  });
});

describe('isoWeekKey', () => {
  it('groups days in the same ISO week', () => {
    expect(isoWeekKey('2026-06-15')).toBe(isoWeekKey('2026-06-17'));
    expect(isoWeekKey('2026-06-15')).not.toBe(isoWeekKey('2026-06-22'));
  });
});
