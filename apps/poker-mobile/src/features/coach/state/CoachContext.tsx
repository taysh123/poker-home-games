import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useEntitlements } from '../../../context/EntitlementsContext';
import * as store from '../data/coachStore';
import { runAnalysis } from '../logic/coachService';
import { creditsRemaining as calcCredits, type CoachDenyReason, type CoachUsage } from '../logic/limits';
import { getCoachProvider } from '../providers';
import { COACH_CONFIG } from '../config';
import type { CoachAnalysis, CoachInput } from '../types';

/**
 * Coach state — orchestrates provider + usage. Premium tier (via entitlements) selects the
 * limits; cost controls stay dormant while COACH_CONFIG.enforceLimits is false.
 */
type CoachContextType = {
  history: CoachAnalysis[];
  usage: CoachUsage;
  isLoaded: boolean;
  isAnalyzing: boolean;
  enforceLimits: boolean;
  creditsRemaining: number;
  analyze: (input: CoachInput) => Promise<{ analysis?: CoachAnalysis; error?: CoachDenyReason }>;
};

const CoachContext = createContext<CoachContextType>({
  history: [], usage: store.emptyFile().usage, isLoaded: false, isAnalyzing: false,
  enforceLimits: false, creditsRemaining: 0,
  analyze: async () => ({}),
});

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { isPremium } = useEntitlements();
  const [file, setFile] = useState<store.CoachFile>(store.emptyFile());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    store.loadFile().then(loaded => { if (!cancelled) { setFile(loaded); setIsLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  const commit = useCallback((next: store.CoachFile) => {
    setFile(next);
    writeQueue.current = writeQueue.current.then(() => store.saveFile(next)).catch(() => {});
    return writeQueue.current;
  }, []);

  const limits = isPremium ? COACH_CONFIG.premiumLimits : COACH_CONFIG.freeLimits;

  const analyze = useCallback(async (input: CoachInput) => {
    setIsAnalyzing(true);
    try {
      const provider = getCoachProvider();
      const out = await runAnalysis(provider, input, {
        usage: file.usage, limits, enforce: COACH_CONFIG.enforceLimits,
      });
      if (out.analysis) {
        await commit(store.recordAnalysis(file, out.analysis, out.usage));
        return { analysis: out.analysis };
      }
      return { error: out.error };
    } finally {
      setIsAnalyzing(false);
    }
  }, [file, limits, commit]);

  return (
    <CoachContext.Provider
      value={{
        history: file.history,
        usage: file.usage,
        isLoaded,
        isAnalyzing,
        enforceLimits: COACH_CONFIG.enforceLimits,
        creditsRemaining: calcCredits(file.usage, limits),
        analyze,
      }}
    >
      {children}
    </CoachContext.Provider>
  );
}

export function useCoach(): CoachContextType {
  return useContext(CoachContext);
}
