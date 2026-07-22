import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as store from '../data/studyStore';
import {
  recordAnswer as applyAnswer,
  recordPracticeAnswer as applyPracticeAnswer,
  setDailyGoal as applyGoal,
  refreshFreezeTokens,
  autoFreezeMissedDay,
  computeStreaksWithFreeze,
  recordQuizFinished as applyQuizFinished,
  recordLessonCompleted as applyLessonDone,
  dailyCountersOf,
} from '../logic/progress';
import { limitStatus, type DailyLimitKind, type LimitStatus } from '../logic/dailyLimits';
import { localDayKey } from '../logic/localDay';
import { STARTER_DATASET } from '../data/starterRanges';
import { isFeatureEnabled } from '../../../config/features';
import { useEntitlements } from '../../../context/EntitlementsContext';
import type { RangeDataset, StudyFile, StudyProgress } from '../types';

/**
 * Study state — progress persistence + the active range dataset. Mirrors the other
 * V2 contexts (load on mount, serialized writes). `dataset` is the starter pack today;
 * an imported (verified) dataset can replace it here later with no UI changes.
 *
 * WRITE API RULE: every exposed write is ONE composed semantic operation (answer, quiz finished,
 * lesson done) — never raw "consume"/"record" halves for callers to chain. Commits are additionally
 * UPDATER-BASED (applied to a live ref of the latest file), so even chained calls compose instead of
 * clobbering. The old value-based commit rebuilt from each callback's render-scope `file`, which
 * bypassed the practice cap (Decision Trainer) and then the daily-quiz cap — twice is enough.
 *
 * STEP 3.1: when `retention` is on, freeze tokens are refilled weekly (free 1 / premium 2)
 * and a single missed yesterday is auto-frozen so the streak survives. Flag off ⇒ unchanged.
 */
type StudyContextType = {
  progress: StudyProgress;
  dataset: RangeDataset;
  isLoaded: boolean;
  /** Record one answered spot (uses today's date for streaks). */
  recordAnswer: (correct: boolean) => Promise<void>;
  /** Record one PRACTICE answer AND consume one from the shared daily pool — a SINGLE commit (Spot + Decision). */
  recordPracticeAnswer: (correct: boolean) => Promise<void>;
  /** Customize the daily goal (clamped 3–25). */
  setDailyGoal: (goal: number) => Promise<void>;
  /** Whether one more metered free rep is allowed today + how many remain (premium ⇒ Infinity). */
  limitFor: (kind: DailyLimitKind) => LimitStatus;
  /** Record one FINISHED quiz: lifetime counter + today's quiz limit — a SINGLE commit. */
  recordQuizFinished: () => Promise<void>;
  /** Record one completed/read lesson (feeds XP). */
  recordLessonCompleted: () => Promise<void>;
};

const StudyContext = createContext<StudyContextType>({
  progress: store.emptyFile().progress,
  dataset: STARTER_DATASET,
  isLoaded: false,
  recordAnswer: async () => {},
  recordPracticeAnswer: async () => {},
  setDailyGoal: async () => {},
  limitFor: () => ({ allowed: true, remaining: Infinity }),
  recordQuizFinished: async () => {},
  recordLessonCompleted: async () => {},
});

// Local-midnight day key — see logic/localDay.ts (was UTC via toISOString, resetting at 02:00-03:00 IL time).
const todayKey = () => localDayKey();

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<StudyFile>(store.emptyFile());
  const [isLoaded, setIsLoaded] = useState(false);
  // Live view of the latest committed file — commits apply updaters to THIS, never to a render-scope
  // snapshot, so back-to-back writes from one event handler compose instead of clobbering.
  const fileRef = useRef<StudyFile>(store.emptyFile());
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const { isPremium } = useEntitlements();

  const commit = useCallback((update: (f: StudyFile) => StudyFile) => {
    const next = update(fileRef.current);
    fileRef.current = next;
    setFile(next);
    writeQueue.current = writeQueue.current.then(() => store.saveFile(next)).catch(() => {});
    return writeQueue.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    store.loadFile().then(loaded => {
      if (cancelled) return;
      let progress = loaded.progress;
      // Retention: weekly token refill + protect a single missed day; recompute streak with freezes.
      if (isFeatureEnabled('retention')) {
        const today = todayKey();
        progress = refreshFreezeTokens(progress, today, isPremium ? 2 : 1);
        progress = autoFreezeMissedDay(progress, today);
        const { current, longest } = computeStreaksWithFreeze(progress.dailyCounts, today, progress.frozenDays ?? []);
        progress = { ...progress, currentStreak: current, longestStreak: Math.max(progress.longestStreak, longest) };
      }
      const next: StudyFile = { ...loaded, progress };
      fileRef.current = next;
      setFile(next);
      setIsLoaded(true);
      if (progress !== loaded.progress) writeQueue.current = writeQueue.current.then(() => store.saveFile(next)).catch(() => {});
    });
    return () => { cancelled = true; };
    // Run once on mount; premium read at mount time (weekly refill self-corrects next session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordAnswer = useCallback(async (correct: boolean) => {
    await commit(f => ({ ...f, progress: applyAnswer(f.progress, correct, todayKey()) }));
  }, [commit]);

  // Composed answer+consume in ONE commit — both trainers call this, so they share ONE daily pool.
  const recordPracticeAnswer = useCallback(async (correct: boolean) => {
    await commit(f => ({ ...f, progress: applyPracticeAnswer(f.progress, correct, todayKey()) }));
  }, [commit]);

  const setDailyGoal = useCallback(async (goal: number) => {
    await commit(f => ({ ...f, progress: applyGoal(f.progress, goal) }));
  }, [commit]);

  const limitFor = useCallback(
    (kind: DailyLimitKind): LimitStatus =>
      limitStatus(dailyCountersOf(file.progress), kind, todayKey(), isPremium),
    [file.progress, isPremium],
  );

  // Composed finish+consume in ONE commit (the split version silently bypassed FREE_QUIZ_PER_DAY).
  const recordQuizFinished = useCallback(async () => {
    await commit(f => ({ ...f, progress: applyQuizFinished(f.progress, todayKey()) }));
  }, [commit]);

  const recordLessonCompleted = useCallback(async () => {
    await commit(f => ({ ...f, progress: applyLessonDone(f.progress) }));
  }, [commit]);

  return (
    <StudyContext.Provider value={{ progress: file.progress, dataset: STARTER_DATASET, isLoaded, recordAnswer, recordPracticeAnswer, setDailyGoal, limitFor, recordQuizFinished, recordLessonCompleted }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy(): StudyContextType {
  return useContext(StudyContext);
}
