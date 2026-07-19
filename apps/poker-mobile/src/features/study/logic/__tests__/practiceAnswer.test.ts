/**
 * Regression + invariant tests for the shared practice pool.
 *
 * BUG (both trainers, but only VISIBLE in Decision mode): the screen recorded an answer and consumed a
 * practice-question in TWO separate context commits built from the SAME base progress, so the second commit
 * (recordAnswer) clobbered the first (consume) → the 'practiceQuestion' counter never incremented. Spot mode
 * masked it (it ends via local `answered >= runCap` state); Decision mode relies solely on the persisted
 * counter, so it never depleted → "Decision Trainer is unlimited / not metered."
 *
 * FIX: one PURE function, recordPracticeAnswer(progress, correct, dayKey), applies BOTH mutations at once, so
 * a single commit carries the recorded answer AND the decremented shared pool. Both trainers call it, so they
 * share ONE daily pool.
 */
import { recordPracticeAnswer, dailyCountersOf, emptyProgress } from '../progress';
import { remainingToday } from '../dailyLimits';
import { FREE_PRACTICE_QUESTIONS_PER_DAY } from '../../config';

const DAY = '2026-07-19';

describe('recordPracticeAnswer — shared daily pool', () => {
  it('records the answer AND consumes one practice question in a single result', () => {
    const p = recordPracticeAnswer(emptyProgress(), true, DAY);
    expect(p.totalAnswered).toBe(1);
    expect(p.totalCorrect).toBe(1);
    expect(dailyCountersOf(p).practiceQuestion).toEqual({ dayKey: DAY, count: 1 });
  });

  it('depletes the pool to zero after FREE_PRACTICE_QUESTIONS_PER_DAY answers (Decision Trainer cannot bypass)', () => {
    let p = emptyProgress();
    for (let i = 0; i < FREE_PRACTICE_QUESTIONS_PER_DAY; i++) {
      expect(remainingToday(dailyCountersOf(p), 'practiceQuestion', DAY, false)).toBeGreaterThan(0);
      p = recordPracticeAnswer(p, i % 2 === 0, DAY);
    }
    expect(remainingToday(dailyCountersOf(p), 'practiceQuestion', DAY, false)).toBe(0);
    expect(p.totalAnswered).toBe(FREE_PRACTICE_QUESTIONS_PER_DAY);
  });

  it('is ONE shared pool: Spot answers and Decision answers sum toward the same counter', () => {
    // The screen is mode-agnostic — both Spot and Decision route every answer through this same function.
    let p = emptyProgress();
    p = recordPracticeAnswer(p, true, DAY);  // e.g. a Spot answer
    p = recordPracticeAnswer(p, false, DAY); // e.g. a Decision answer
    p = recordPracticeAnswer(p, true, DAY);  // another Decision answer
    expect(dailyCountersOf(p).practiceQuestion.count).toBe(3);
    expect(remainingToday(dailyCountersOf(p), 'practiceQuestion', DAY, false)).toBe(FREE_PRACTICE_QUESTIONS_PER_DAY - 3);
  });

  it('resets the pool on a new local day', () => {
    let p = emptyProgress();
    for (let i = 0; i < FREE_PRACTICE_QUESTIONS_PER_DAY; i++) p = recordPracticeAnswer(p, true, DAY);
    expect(remainingToday(dailyCountersOf(p), 'practiceQuestion', '2026-07-20', false)).toBe(FREE_PRACTICE_QUESTIONS_PER_DAY);
  });

  it('the daily cap is 10', () => {
    expect(FREE_PRACTICE_QUESTIONS_PER_DAY).toBe(10);
  });
});
