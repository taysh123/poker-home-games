import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as store from '../data/studyStore';
import { recordAnswer as applyAnswer } from '../logic/progress';
import { STARTER_DATASET } from '../data/starterRanges';
import type { RangeDataset, StudyFile, StudyProgress } from '../types';

/**
 * Study state — progress persistence + the active range dataset. Mirrors the other
 * V2 contexts (load on mount, serialized writes). `dataset` is the starter pack today;
 * an imported (verified) dataset can replace it here later with no UI changes.
 */
type StudyContextType = {
  progress: StudyProgress;
  dataset: RangeDataset;
  isLoaded: boolean;
  /** Record one answered spot (uses today's date for streaks). */
  recordAnswer: (correct: boolean) => Promise<void>;
};

const StudyContext = createContext<StudyContextType>({
  progress: store.emptyFile().progress,
  dataset: STARTER_DATASET,
  isLoaded: false,
  recordAnswer: async () => {},
});

const todayKey = () => new Date().toISOString().slice(0, 10);

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<StudyFile>(store.emptyFile());
  const [isLoaded, setIsLoaded] = useState(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    store.loadFile().then(loaded => {
      if (!cancelled) {
        setFile(loaded);
        setIsLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const commit = useCallback((next: StudyFile) => {
    setFile(next);
    writeQueue.current = writeQueue.current.then(() => store.saveFile(next)).catch(() => {});
    return writeQueue.current;
  }, []);

  const recordAnswer = useCallback(async (correct: boolean) => {
    const next: StudyFile = {
      ...file,
      progress: applyAnswer(file.progress, correct, todayKey()),
    };
    await commit(next);
  }, [file, commit]);

  return (
    <StudyContext.Provider value={{ progress: file.progress, dataset: STARTER_DATASET, isLoaded, recordAnswer }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy(): StudyContextType {
  return useContext(StudyContext);
}
