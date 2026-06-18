import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { useAuth } from '../../../context/AuthContext';
import { accountKeyFor, isSignedIn } from '../../auth/identity';
import * as store from '../data/coachStore';
import { runAnalysis } from '../logic/coachService';
import { creditsRemaining as calcCredits, type CoachDenyReason, type CoachLimits } from '../logic/limits';
import { getCoachProvider } from '../providers';
import { COACH_CONFIG } from '../config';
import type { CoachAnalysis, CoachInput } from '../types';

/**
 * Coach state — orchestrates provider + ACCOUNT-BASED AI usage. Usage is keyed by the
 * signed-in identity (accountKeyFor), so credits can't be farmed by reinstalling or
 * across devices. The monthly allowance comes from the entitlement TIER; cost controls
 * + the sign-in gate stay dormant until the server is authoritative.
 */
type CoachError = CoachDenyReason | 'requires_account';

type CoachContextType = {
  history: CoachAnalysis[];
  isLoaded: boolean;
  isAnalyzing: boolean;
  enforceLimits: boolean;
  requiresAccount: boolean;
  signedIn: boolean;
  creditsRemaining: number;
  monthlyCredits: number;
  analyze: (input: CoachInput) => Promise<{ analysis?: CoachAnalysis; error?: CoachError }>;
};

const CoachContext = createContext<CoachContextType>({
  history: [], isLoaded: false, isAnalyzing: false, enforceLimits: false,
  requiresAccount: false, signedIn: false, creditsRemaining: 0, monthlyCredits: 0,
  analyze: async () => ({}),
});

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { aiMonthlyCredits, isPremium } = useEntitlements();
  const { user } = useAuth();
  const accountKey = accountKeyFor(user);
  const signedIn = isSignedIn(user);

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

  // Monthly credit allowance from the account's tier; rate limit from config.
  const limits: CoachLimits = useMemo(
    () => ({ monthlyCredits: aiMonthlyCredits, minIntervalMs: isPremium ? COACH_CONFIG.premiumRateMs : COACH_CONFIG.freeRateMs }),
    [aiMonthlyCredits, isPremium],
  );

  const usage = store.getUsage(file, accountKey);

  const analyze = useCallback(async (input: CoachInput) => {
    // Anti-abuse: AI requires a verified account once enabled (free quota tied to identity).
    if (COACH_CONFIG.requireAccount && !signedIn) return { error: 'requires_account' as const };
    setIsAnalyzing(true);
    try {
      const out = await runAnalysis(getCoachProvider(), input, {
        usage: store.getUsage(file, accountKey),
        limits,
        enforce: COACH_CONFIG.enforceLimits,
      });
      if (out.analysis) {
        await commit(store.recordAnalysis(file, accountKey, out.analysis, out.usage));
        return { analysis: out.analysis };
      }
      return { error: out.error };
    } finally {
      setIsAnalyzing(false);
    }
  }, [file, accountKey, limits, signedIn, commit]);

  return (
    <CoachContext.Provider
      value={{
        history: file.history,
        isLoaded,
        isAnalyzing,
        enforceLimits: COACH_CONFIG.enforceLimits,
        requiresAccount: COACH_CONFIG.requireAccount,
        signedIn,
        creditsRemaining: calcCredits(usage, limits),
        monthlyCredits: aiMonthlyCredits,
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
