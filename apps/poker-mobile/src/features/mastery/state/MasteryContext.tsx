/**
 * MasteryContext — thin, flag-gated wrapper over the attempt store + aggregation. Records graded attempts and
 * exposes per-objective mastery from REAL recorded data only.
 *
 * Inert when the `mastery` flag is OFF: it never loads the store and `record()` is a no-op, so production is
 * byte-identical (the provider can be mounted unconditionally, like ContentProvider). Writes are serialized.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isFeatureEnabled } from '../../../config/features';
import * as store from '../data/attemptStore';
import { masteryByKey, totalAttempts } from '../logic/aggregate';
import type { ObjectiveStat, ObjectiveMastery } from '../types';

interface MasteryContextValue {
  enabled: boolean;
  statsByKey: Record<string, ObjectiveStat>;
  /** Record one graded attempt for an objective key (no-op when the flag is OFF or key is empty). */
  record: (objectiveKey: string, correct: boolean) => void;
  /** Mastery state for a key from real attempts, or null if none recorded. */
  masteryFor: (objectiveKey: string) => ObjectiveMastery | null;
  /** Total attempts recorded — for honest "based on N attempts" copy. */
  totalAttempts: number;
}

const DISABLED: MasteryContextValue = {
  enabled: false, statsByKey: {}, record: () => {}, masteryFor: () => null, totalAttempts: 0,
};

const Ctx = createContext<MasteryContextValue>(DISABLED);

export function MasteryProvider({ children }: { children: React.ReactNode }) {
  const enabled = isFeatureEnabled('mastery');
  const [file, setFile] = useState(store.emptyFile());
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    store.loadFile().then(f => { if (!cancelled) setFile(f); }).catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  const record = useCallback((objectiveKey: string, correct: boolean) => {
    if (!enabled || !objectiveKey) return;
    setFile(prev => {
      const next = store.recordAttempt(prev, objectiveKey, correct, Date.now());
      writeQueue.current = writeQueue.current.then(() => store.saveFile(next)).catch(() => {});
      return next;
    });
  }, [enabled]);

  const masteryMap = useMemo(() => masteryByKey(file.statsByKey), [file.statsByKey]);

  const value = useMemo<MasteryContextValue>(() => {
    if (!enabled) return DISABLED;
    return {
      enabled: true,
      statsByKey: file.statsByKey,
      record,
      masteryFor: (k: string) => masteryMap[k] ?? null,
      totalAttempts: totalAttempts(file.statsByKey),
    };
  }, [enabled, file.statsByKey, masteryMap, record]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMastery(): MasteryContextValue {
  return useContext(Ctx);
}
