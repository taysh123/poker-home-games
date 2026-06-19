import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as store from '../data/studyStore';
import {
  recordAnswer as applyAnswer,
  setDailyGoal as applyGoal,
  refreshFreezeTokens,
  autoFreezeMissedDay,
  computeStreaksWithFreeze,
} from '../logic/progress';
import { STARTER_DATASET } from '../data/starterRanges';
import { isFeatureEnabled } from '../../../config/features';
import { useEntitlements } from '../../../context/EntitlementsContext';
import type { RangeDataset, StudyFile, StudyProgress } from '../types';

/**
 * Study state — progress persistence + the active range dataset. Mirrors the other
 * V2 contexts (load on mount, serialized writes). `dataset` is the starter pack today;
 * an imported (verified) dataset can replace it here later with no UI changes.
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
  /** Customize the daily goal (clamped 3–25). */
  setDailyGoal: (goal: number) => Promise<void>;
};

const StudyContext = createContext<StudyContextType>({
  progress: store.emptyFile().progress,
  dataset: STARTER_DATASET,
  isLoaded: false,
  recordAnswer: async () => {},
  setDailyGoal: async () => {},
});

const todayKey = () => new Date().toISOString().slice(0, 10);

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<StudyFile>(store.emptyFile());
  const [isLoaded, setIsLoaded] = useState(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const { isPremium } = useEntitlements();

  const commit = useCallback((next: StudyFile) => {
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
      setFile(next);
      setIsLoaded(true);
      if (progress !== loaded.progress) writeQueue.current = writeQueue.current.then(() => store.saveFile(next)).catch(() => {});
    });
    return () => { cancelled = true; };
    // Run once on mount; premium read at mount time (weekly refill self-corrects next session).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordAnswer = useCallback(async (correct: boolean) => {
    await commit({ ...file, progress: applyAnswer(file.progress, correct, todayKey()) });
  }, [file, commit]);

  const setDailyGoal = useCallback(async (goal: number) => {
    await commit({ ...file, progress: applyGoal(file.progress, goal) });
  }, [file, commit]);

  return (
    <StudyContext.Provider value={{ progress: file.progress, dataset: STARTER_DATASET, isLoaded, recordAnswer, setDailyGoal }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy(): StudyContextType {
  return useContext(StudyContext);
}
