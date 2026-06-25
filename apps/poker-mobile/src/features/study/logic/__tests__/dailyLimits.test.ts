// apps/poker-mobile/src/features/study/logic/__tests__/dailyLimits.test.ts
import {
  emptyDailyCounters,
  remainingToday,
  limitStatus,
  consumeToday,
  type DailyLimitCounters,
} from '../dailyLimits';
import { FREE_QUIZ_PER_DAY, FREE_TRAINER_SESSIONS_PER_DAY } from '../../config';

const TODAY = '2026-06-25';
const YESTERDAY = '2026-06-24';

describe('emptyDailyCounters', () => {
  it('starts both kinds at zero with no day', () => {
    const c = emptyDailyCounters();
    expect(c.quiz).toEqual({ dayKey: '', count: 0 });
    expect(c.trainerSession).toEqual({ dayKey: '', count: 0 });
  });
});

describe('remainingToday', () => {
  it('returns the full free allowance when nothing done today (free user)', () => {
    expect(remainingToday(emptyDailyCounters(), 'quiz', TODAY, false)).toBe(FREE_QUIZ_PER_DAY);
    expect(remainingToday(emptyDailyCounters(), 'trainerSession', TODAY, false)).toBe(FREE_TRAINER_SESSIONS_PER_DAY);
  });

  it('subtracts today’s count for a free user', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), trainerSession: { dayKey: TODAY, count: 2 } };
    expect(remainingToday(c, 'trainerSession', TODAY, false)).toBe(FREE_TRAINER_SESSIONS_PER_DAY - 2);
  });

  it('never goes negative even if the stored count somehow exceeds the cap', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: TODAY, count: 99 } };
    expect(remainingToday(c, 'quiz', TODAY, false)).toBe(0);
  });

  it('resets to the full allowance on a new local day (yesterday’s count is ignored)', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: YESTERDAY, count: FREE_QUIZ_PER_DAY } };
    expect(remainingToday(c, 'quiz', TODAY, false)).toBe(FREE_QUIZ_PER_DAY);
  });

  it('is Infinity for premium regardless of count', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: TODAY, count: 100 } };
    expect(remainingToday(c, 'quiz', TODAY, true)).toBe(Infinity);
  });
});

describe('limitStatus', () => {
  it('allows a free user with reps left and reports remaining', () => {
    expect(limitStatus(emptyDailyCounters(), 'quiz', TODAY, false)).toEqual({ allowed: true, remaining: FREE_QUIZ_PER_DAY });
  });

  it('blocks a free user once the daily cap is reached', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: TODAY, count: FREE_QUIZ_PER_DAY } };
    expect(limitStatus(c, 'quiz', TODAY, false)).toEqual({ allowed: false, remaining: 0 });
  });

  it('blocks the 4th trainer session of the day for a free user', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), trainerSession: { dayKey: TODAY, count: FREE_TRAINER_SESSIONS_PER_DAY } };
    const s = limitStatus(c, 'trainerSession', TODAY, false);
    expect(s.allowed).toBe(false);
    expect(s.remaining).toBe(0);
  });

  it('re-allows after the day rolls over', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), trainerSession: { dayKey: YESTERDAY, count: FREE_TRAINER_SESSIONS_PER_DAY } };
    expect(limitStatus(c, 'trainerSession', TODAY, false)).toEqual({ allowed: true, remaining: FREE_TRAINER_SESSIONS_PER_DAY });
  });

  it('always allows premium with remaining Infinity', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: TODAY, count: 50 } };
    expect(limitStatus(c, 'quiz', TODAY, true)).toEqual({ allowed: true, remaining: Infinity });
  });
});

describe('consumeToday', () => {
  it('increments the kind for today, leaving the other kind untouched', () => {
    const next = consumeToday(emptyDailyCounters(), 'quiz', TODAY);
    expect(next.quiz).toEqual({ dayKey: TODAY, count: 1 });
    expect(next.trainerSession).toEqual({ dayKey: '', count: 0 });
  });

  it('resets the count to 1 when consuming on a new day', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: YESTERDAY, count: 5 } };
    expect(consumeToday(c, 'quiz', TODAY).quiz).toEqual({ dayKey: TODAY, count: 1 });
  });

  it('accumulates within the same day', () => {
    let c = consumeToday(emptyDailyCounters(), 'trainerSession', TODAY);
    c = consumeToday(c, 'trainerSession', TODAY);
    expect(c.trainerSession).toEqual({ dayKey: TODAY, count: 2 });
  });

  it('is pure — does not mutate the input', () => {
    const c = emptyDailyCounters();
    const next = consumeToday(c, 'quiz', TODAY);
    expect(c.quiz.count).toBe(0);
    expect(next).not.toBe(c);
  });

  it('three consumes then a block models the free trainer day exactly', () => {
    let c = emptyDailyCounters();
    for (let i = 0; i < FREE_TRAINER_SESSIONS_PER_DAY; i++) {
      expect(limitStatus(c, 'trainerSession', TODAY, false).allowed).toBe(true);
      c = consumeToday(c, 'trainerSession', TODAY);
    }
    expect(limitStatus(c, 'trainerSession', TODAY, false).allowed).toBe(false);
  });
});
