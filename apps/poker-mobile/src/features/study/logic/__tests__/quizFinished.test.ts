/**
 * BUG (shipped free-first build): QuizRunnerScreen.finishQuiz chained TWO context commits —
 *   void consumeLimit('quiz'); void recordQuizCompleted();
 * Both callbacks closed over the same render-scope file, so the second commit rebuilt from the
 * stale base and ERASED the counter increment: FREE_QUIZ_PER_DAY=1 was never actually consumed.
 * Same class as the Decision-Trainer practice bug (see practiceAnswer.test.ts).
 *
 * FIX: one PURE function, recordQuizFinished(progress, dayKey), applies BOTH mutations at once —
 * consume one 'quiz' unit from today's limit AND bump the lifetime quizzesCompleted counter —
 * so a single context commit carries the whole "quiz finished" transition.
 */
import { emptyProgress, recordQuizFinished, dailyCountersOf } from '../progress';
import { limitStatus } from '../dailyLimits';
import { FREE_QUIZ_PER_DAY } from '../../config';

const DAY = '2026-07-22';

describe('recordQuizFinished (composed single-commit quiz completion)', () => {
  it('consumes one quiz unit AND increments quizzesCompleted in one result', () => {
    const p = recordQuizFinished(emptyProgress(), DAY);
    expect(p.quizzesCompleted).toBe(1);
    expect(limitStatus(dailyCountersOf(p), 'quiz', DAY, false).remaining).toBe(FREE_QUIZ_PER_DAY - 1);
  });

  it('reaches the free daily quiz cap after FREE_QUIZ_PER_DAY finishes', () => {
    let p = emptyProgress();
    for (let i = 0; i < FREE_QUIZ_PER_DAY; i++) p = recordQuizFinished(p, DAY);
    const status = limitStatus(dailyCountersOf(p), 'quiz', DAY, false);
    expect(status.allowed).toBe(false);
    expect(status.remaining).toBe(0);
    expect(p.quizzesCompleted).toBe(FREE_QUIZ_PER_DAY);
  });

  it('resets on a new local day while the lifetime counter keeps counting', () => {
    let p = recordQuizFinished(emptyProgress(), DAY);
    expect(limitStatus(dailyCountersOf(p), 'quiz', DAY, false).allowed).toBe(FREE_QUIZ_PER_DAY > 1);

    const NEXT_DAY = '2026-07-23';
    p = recordQuizFinished(p, NEXT_DAY);
    expect(p.quizzesCompleted).toBe(2);
    expect(limitStatus(dailyCountersOf(p), 'quiz', NEXT_DAY, false).remaining).toBe(FREE_QUIZ_PER_DAY - 1);
  });

  it('does not touch streak/goal state (quiz answers are not practice reps)', () => {
    const p = recordQuizFinished(emptyProgress(), DAY);
    expect(p.dailyCounts).toEqual({});
    expect(p.totalAnswered).toBe(0);
    expect(p.currentStreak).toBe(0);
  });
});
