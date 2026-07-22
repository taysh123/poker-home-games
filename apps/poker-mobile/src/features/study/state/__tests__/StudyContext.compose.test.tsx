/**
 * REGRESSION — the "chained context writes clobber each other" bug class, which has now bitten TWICE
 * (Decision-Trainer practice cap, then the daily-quiz cap): every write callback closed over the
 * render-scope `file`, so two back-to-back calls from one event handler both rebuilt from the SAME
 * stale base and the second commit erased the first.
 *
 * The structural fix makes StudyContext commits UPDATER-BASED (applied to a live ref of the latest
 * file), so chained writes compose no matter how call sites are written. This test fires two
 * different writes in the same tick — exactly the shipped pattern — and asserts BOTH landed.
 */
import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../../../../context/EntitlementsContext', () => ({
  useEntitlements: () => ({ isPremium: false }),
}));
// Retention mount pass (freeze refill) is irrelevant here — keep the render deterministic.
jest.mock('../../../../config/features', () => ({
  isFeatureEnabled: () => false,
}));

import { StudyProvider, useStudy } from '../StudyContext';

type Ctx = ReturnType<typeof useStudy>;
let ctx: Ctx;

function Probe() {
  ctx = useStudy();
  return null;
}

async function renderStudy(): Promise<void> {
  render(
    <StudyProvider>
      <Probe />
    </StudyProvider>,
  );
  await waitFor(() => expect(ctx.isLoaded).toBe(true));
}

describe('StudyContext — chained writes compose (never clobber)', () => {
  it('two different writes fired in the same tick both land', async () => {
    await renderStudy();

    await act(async () => {
      // No await between the calls — the shipped QuizRunner/DecisionTrainer pattern.
      const a = ctx.recordAnswer(true);
      const b = ctx.recordLessonCompleted();
      await Promise.all([a, b]);
    });

    expect(ctx.progress.totalAnswered).toBe(1);
    expect(ctx.progress.lessonsCompleted).toBe(1);
  });

  it('finishing a quiz consumes the daily quiz limit AND records the completion (single commit)', async () => {
    await renderStudy();

    expect(ctx.limitFor('quiz').allowed).toBe(true);
    await act(async () => {
      await ctx.recordQuizFinished();
    });

    expect(ctx.progress.quizzesCompleted).toBe(1);
    // FREE_QUIZ_PER_DAY = 1 → the cap must now actually be reached (the shipped bug left it open forever).
    expect(ctx.limitFor('quiz').remaining).toBe(0);
    expect(ctx.limitFor('quiz').allowed).toBe(false);
  });
});
