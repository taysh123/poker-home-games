import { emptyProgress, recordAnswer, computeStreaks, studyStats } from '../progress';

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
