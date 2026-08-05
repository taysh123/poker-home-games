import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { accountKeyFor } from '../../auth/identity';
import * as store from '../data/bankrollStore';
import type { BankrollFile, BankrollSession, BankrollSettings } from '../types';

/**
 * Bankroll state (B1 — account-scoped). Reads resolve against `accountKeyFor(user)` live, and
 * when a signed-in account key appears with no bankroll data of its own, the guest history is
 * claimed into it (pure `claimGuestBankroll`; an account's own data always wins).
 *
 * Commit pattern follows `PersonaContext` exactly (which itself follows StudyContext's
 * CORRECTED pattern): an updater-based commit against a live `fileRef`, serialized through one
 * `writeQueue`, not the OLD value-based `commit(next: BankrollFile)` this context used before
 * B1. That old shape closed over `file` from the render that scheduled it — two commits fired
 * in the same tick (very plausibly `addSession` racing the sign-in claim effect this slice
 * adds) would have the second overwrite the first using a stale `file`, silently dropping a
 * write. The claim effect is a NEW concurrent writer, so grafting account-scoping onto the old
 * pattern would have introduced exactly the clobber bug CLAUDE.md says shipped twice already.
 */
type BankrollContextType = {
  sessions: BankrollSession[];
  settings: BankrollSettings;
  isLoaded: boolean;
  addSession: (input: store.CreateSessionInput) => Promise<BankrollSession>;
  updateSession: (id: string, updates: Partial<store.CreateSessionInput>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<BankrollSettings>) => Promise<void>;
};

const DEFAULT_SETTINGS: BankrollSettings = { startingBankrollCents: 0, currency: 'ILS' };
const noop = async () => { throw new Error('BankrollProvider missing'); };
const BankrollContext = createContext<BankrollContextType>({
  sessions: [],
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  addSession: noop as never,
  updateSession: noop,
  deleteSession: noop,
  updateSettings: noop,
});

export function BankrollProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const accountKey = accountKeyFor(user);

  const [file, setFile] = useState<BankrollFile>(store.emptyFile());
  const [isLoaded, setIsLoaded] = useState(false);
  const fileRef = useRef<BankrollFile>(store.emptyFile());
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((update: (f: BankrollFile) => BankrollFile) => {
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
  // Also the path a v1→v2 migration relies on: pre-scoping data lands in the guest bucket
  // (bankrollStore's migrateToCurrent), and this is what carries it into an account — exactly
  // like a brand-new guest→account claim, never pre-attributed at load time.
  useEffect(() => {
    if (!isLoaded) return;
    void commit(f => store.claimGuestBankroll(f, accountKey));
  }, [isLoaded, accountKey, commit]);

  const addSession = useCallback(async (input: store.CreateSessionInput) => {
    let created!: BankrollSession;
    await commit(f => {
      const { file: next, session } = store.addSession(f, accountKey, input);
      created = session;
      return next;
    });
    return created;
  }, [commit, accountKey]);

  const updateSession = useCallback(async (id: string, updates: Partial<store.CreateSessionInput>) => {
    await commit(f => store.updateSession(f, accountKey, id, updates));
  }, [commit, accountKey]);

  const deleteSession = useCallback(async (id: string) => {
    await commit(f => store.deleteSession(f, accountKey, id));
  }, [commit, accountKey]);

  const updateSettings = useCallback(async (updates: Partial<BankrollSettings>) => {
    await commit(f => store.updateSettings(f, accountKey, updates));
  }, [commit, accountKey]);

  const { sessions, settings } = useMemo(() => store.accountDataFor(file, accountKey), [file, accountKey]);

  return (
    <BankrollContext.Provider
      value={{ sessions, settings, isLoaded, addSession, updateSession, deleteSession, updateSettings }}
    >
      {children}
    </BankrollContext.Provider>
  );
}

export function useBankroll(): BankrollContextType {
  return useContext(BankrollContext);
}
