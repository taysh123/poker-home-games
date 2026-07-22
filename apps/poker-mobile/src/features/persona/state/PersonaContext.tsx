/**
 * Persona state (Wave 1, slice 1.2). Follows StudyContext's CORRECTED write pattern exactly:
 * a live fileRef + serialized writeQueue, commits are UPDATER-based (chained writes compose —
 * the value-based commit clobbered twice before), and the exposed API is composed semantic
 * operations only. Reads resolve against accountKeyFor(user) live, and when a signed-in account
 * key appears with no persona of its own, the guest quiz answers are claimed into it (pure
 * claimGuestPersona; an account's own answers always win).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { accountKeyFor } from '../../auth/identity';
import { emptyPersona, type Persona } from '../types';
import { applyAnswer, type QuizStep } from '../logic/funnel';
import { skillFromPlacement } from '../logic/placement';
import * as store from '../data/personaStore';

type PersonaContextType = {
  /** The active account's persona, or null if the quiz was never taken. */
  persona: Persona | null;
  isLoaded: boolean;
  /** Record one funnel answer — ONE composed commit per answer. */
  answerStep: (step: QuizStep, answerId: string) => Promise<void>;
  /** Stamp completion (idempotent). */
  completeFunnel: () => Promise<void>;
  /** Record a finished placement drill AND set the measured skill — ONE composed commit. */
  recordPlacement: (score: number, total: number) => Promise<void>;
};

const PersonaContext = createContext<PersonaContextType>({
  persona: null,
  isLoaded: false,
  answerStep: async () => {},
  completeFunnel: async () => {},
  recordPlacement: async () => {},
});

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const accountKey = accountKeyFor(user);

  const [file, setFile] = useState<store.PersonaFile>(store.emptyFile());
  const [isLoaded, setIsLoaded] = useState(false);
  const fileRef = useRef<store.PersonaFile>(store.emptyFile());
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((update: (f: store.PersonaFile) => store.PersonaFile) => {
    const next = update(fileRef.current);
    if (next === fileRef.current) return writeQueue.current; // pure no-op — skip state + disk
    fileRef.current = next;
    setFile(next);
    writeQueue.current = writeQueue.current.then(() => store.saveFile(next)).catch(() => {});
    return writeQueue.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    store.loadFile().then(loaded => {
      if (cancelled) return;
      fileRef.current = loaded;
      setFile(loaded);
      setIsLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Guest→account claim: fires when a signed-in key appears (mount-with-user or account switch).
  useEffect(() => {
    if (!isLoaded) return;
    void commit(f => store.claimGuestPersona(f, accountKey));
  }, [isLoaded, accountKey, commit]);

  const answerStep = useCallback(async (step: QuizStep, answerId: string) => {
    const now = new Date().toISOString();
    await commit(f => {
      const current = store.personaFor(f, accountKey) ?? emptyPersona(now);
      return store.withPersona(f, accountKey, applyAnswer(current, step, answerId, now));
    });
  }, [commit, accountKey]);

  const completeFunnel = useCallback(async () => {
    const now = new Date().toISOString();
    await commit(f => {
      const current = store.personaFor(f, accountKey) ?? emptyPersona(now);
      if (current.completedAt) return f; // idempotent
      return store.withPersona(f, accountKey, { ...current, completedAt: now, updatedAt: now });
    });
  }, [commit, accountKey]);

  const recordPlacement = useCallback(async (score: number, total: number) => {
    const now = new Date().toISOString();
    await commit(f => {
      const current = store.personaFor(f, accountKey) ?? emptyPersona(now);
      return store.withPersona(f, accountKey, {
        ...current,
        // The measured level replaces the self-report — both land in one commit.
        skill: skillFromPlacement(score),
        placement: { score, total, at: now },
        updatedAt: now,
      });
    });
  }, [commit, accountKey]);

  const persona = useMemo(() => store.personaFor(file, accountKey), [file, accountKey]);

  return (
    <PersonaContext.Provider value={{ persona, isLoaded, answerStep, completeFunnel, recordPlacement }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona(): PersonaContextType {
  return useContext(PersonaContext);
}
