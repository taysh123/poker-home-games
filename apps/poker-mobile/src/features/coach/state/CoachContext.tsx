import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { useAuth } from '../../../context/AuthContext';
import { accountKeyFor, isSignedIn } from '../../auth/identity';
import { SERVER_AUTHORITATIVE } from '../../premium/config';
import * as store from '../data/coachStore';
import * as SecureStore from '../../../utils/storage';
import { runAnalysis } from '../logic/coachService';
import { creditsRemaining as calcCredits } from '../logic/limits';
import { getCoachProvider } from '../providers';
import { serverCoachProvider } from '../providers/serverCoachProvider';
import { getCoachCredits, ServerCoachError, type ServerCoachCredits } from '../../../api/monetizationApi';
import { COACH_CONFIG } from '../config';
import type { CoachAnalysis, CoachInput } from '../types';

/**
 * Coach state — orchestrates the provider + AI credits. B4: when SERVER_AUTHORITATIVE, credits come
 * from `GET /api/coach/credits` and every analysis runs through the server proxy (`serverCoachProvider`)
 * — the server reserves/enforces credits and holds the vendor key. The local credit engine is kept
 * only as a fail-closed offline path. No anonymous AI (guests denied: requires_account).
 */
type CoachError = 'requires_account' | 'rate_limited' | 'no_credits' | 'unavailable';

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
  /** Re-fetch server credits (call after an analysis or on focus). No-op in local mode. */
  refreshCredits: () => Promise<void>;
};

const CoachContext = createContext<CoachContextType>({
  history: [], isLoaded: false, isAnalyzing: false, signedIn: false,
  creditsRemaining: 0, totalCredits: 0, policyKind: 'lifetime',
  analyze: async () => ({}),
  refreshCredits: async () => {},
});

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { aiCreditPolicy } = useEntitlements();
  const { user } = useAuth();
  const accountKey = accountKeyFor(user);
  const signedIn = isSignedIn(user);

  const [file, setFile] = useState<store.CoachFile>(store.emptyFile());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [serverCredits, setServerCredits] = useState<ServerCoachCredits | null>(null);
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

  const refreshCredits = useCallback(async () => {
    if (!SERVER_AUTHORITATIVE || !signedIn) { setServerCredits(null); return; }
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;
      setServerCredits(await getCoachCredits(token));
    } catch {
      /* keep last-known balance; fail-closed display, server stays authority on spend */
    }
  }, [signedIn]);

  // Refresh server credits when the account changes.
  useEffect(() => { refreshCredits(); }, [refreshCredits, accountKey]);

  const analyze = useCallback(async (input: CoachInput) => {
    setIsAnalyzing(true);
    try {
      if (SERVER_AUTHORITATIVE) {
        // No anonymous AI — deny before any network call.
        if (!signedIn) return { error: 'requires_account' as CoachError };
        try {
          const analysis = await serverCoachProvider.analyze({ input });
          // Record to local history only (server owns credit usage); keep usage untouched.
          await commit(store.recordAnalysis(file, accountKey, analysis, store.getUsage(file, accountKey)));
          await refreshCredits();
          return { analysis };
        } catch (e) {
          const reason = (e instanceof ServerCoachError ? e.reason : 'unavailable') as CoachError;
          return { error: reason };
        }
      }

      // Legacy local mode (display-only enforcement) — unchanged.
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
  }, [file, accountKey, aiCreditPolicy, signedIn, commit, refreshCredits]);

  // Display: prefer server numbers when authoritative; fall back to the local cache (fail-closed).
  const localRemaining = calcCredits(store.getUsage(file, accountKey), aiCreditPolicy);
  const useServer = SERVER_AUTHORITATIVE && serverCredits !== null;
  const creditsRemaining = useServer ? serverCredits!.remaining : localRemaining;
  const totalCredits = useServer ? serverCredits!.total : aiCreditPolicy.credits;
  const policyKind: 'lifetime' | 'monthly' =
    useServer ? (serverCredits!.policyKind === 'monthly' ? 'monthly' : 'lifetime') : aiCreditPolicy.kind;

  return (
    <CoachContext.Provider
      value={{
        history: file.history,
        isLoaded,
        isAnalyzing,
        signedIn,
        creditsRemaining,
        totalCredits,
        policyKind,
        analyze,
        refreshCredits,
      }}
    >
      {children}
    </CoachContext.Provider>
  );
}

export function useCoach(): CoachContextType {
  return useContext(CoachContext);
}
