import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { useAuth } from '../../../context/AuthContext';
import { accountKeyFor, isSignedIn } from '../../auth/identity';
import * as store from '../data/coachStore';
import { runAnalysis } from '../logic/coachService';
import { creditsRemaining as calcCredits } from '../logic/limits';
import { getCoachProvider } from '../providers';
import { COACH_CONFIG } from '../config';
import type { CoachAnalysis, CoachInput } from '../types';

/**
 * Coach state — orchestrates provider + ACCOUNT-BASED, FAIL-CLOSED AI credits. Allowance
 * comes from the entitlement tier (free = 1 lifetime / premium = 30 monthly); guests get
 * none (no anonymous AI). Client enforces for UX; the server becomes authoritative pre-launch.
 */
type CoachError = 'requires_account' | 'rate_limited' | 'no_credits';

type CoachContextType = {
  history: CoachAnalysis[];
  isLoaded: boolean;
  isAnalyzing: boolean;
  signedIn: boolean;
  /** Credits remaining for the current account + tier. */
  creditsRemaining: number;
  /** Total credits in the current policy (e.g. 1 lifetime / 30 monthly). */
  totalCredits: number;
  /** 'lifetime' (free onboarding) or 'monthly' (premium). */
  policyKind: 'lifetime' | 'monthly';
  analyze: (input: CoachInput) => Promise<{ analysis?: CoachAnalysis; error?: CoachError }>;
};

const CoachContext = createContext<CoachContextType>({
  history: [], isLoaded: false, isAnalyzing: false, signedIn: false,
  creditsRemaining: 0, totalCredits: 0, policyKind: 'lifetime',
  analyze: async () => ({}),
});

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { aiCreditPolicy } = useEntitlements();
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

  const analyze = useCallback(async (input: CoachInput) => {
    setIsAnalyzing(true);
    try {
      const out = await runAnalysis(getCoachProvider(), input, {
        usage: store.getUsage(file, accountKey),
        policy: aiCreditPolicy,
        enforce: COACH_CONFIG.enforceLimits,
        signedIn,
        requireAccount: COACH_CONFIG.requireAccount,
      });
      if (out.analysis) {
        await commit(store.recordAnalysis(file, accountKey, out.analysis, out.usage));
        return { analysis: out.analysis };
      }
      return { error: out.error };
    } finally {
      setIsAnalyzing(false);
    }
  }, [file, accountKey, aiCreditPolicy, signedIn, commit]);

  return (
    <CoachContext.Provider
      value={{
        history: file.history,
        isLoaded,
        isAnalyzing,
        signedIn,
        creditsRemaining: calcCredits(store.getUsage(file, accountKey), aiCreditPolicy),
        totalCredits: aiCreditPolicy.credits,
        policyKind: aiCreditPolicy.kind,
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
