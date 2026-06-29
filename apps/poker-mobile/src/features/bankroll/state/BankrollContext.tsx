import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as store from '../data/bankrollStore';
import type { BankrollFile, BankrollSession, BankrollSettings } from '../types';

/**
 * Bankroll state — thin React wrapper over the pure store (mirrors LocalGamesContext):
 * load on mount, serialized writes, state is source of truth until the next save.
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

const noop = async () => { throw new Error('BankrollProvider missing'); };
const BankrollContext = createContext<BankrollContextType>({
  sessions: [],
  settings: { startingBankrollCents: 0, currency: 'ILS' },
  isLoaded: false,
  addSession: noop as never,
  updateSession: noop,
  deleteSession: noop,
  updateSettings: noop,
});

export function BankrollProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<BankrollFile>(store.emptyFile());
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

  const commit = useCallback((next: BankrollFile) => {
    setFile(next);
    writeQueue.current = writeQueue.current
      .then(() => store.saveFile(next))
      .catch(() => { /* non-critical: state is source of truth until next save */ });
    return writeQueue.current;
  }, []);

  const addSession = useCallback(async (input: store.CreateSessionInput) => {
    const { file: next, session } = store.addSession(file, input);
    await commit(next);
    return session;
  }, [file, commit]);

  const updateSession = useCallback(async (id: string, updates: Partial<store.CreateSessionInput>) => {
    await commit(store.updateSession(file, id, updates));
  }, [file, commit]);

  const deleteSession = useCallback(async (id: string) => {
    await commit(store.deleteSession(file, id));
  }, [file, commit]);

  const updateSettings = useCallback(async (updates: Partial<BankrollSettings>) => {
    await commit(store.updateSettings(file, updates));
  }, [file, commit]);

  return (
    <BankrollContext.Provider
      value={{
        sessions: file.sessions,
        settings: file.settings,
        isLoaded,
        addSession,
        updateSession,
        deleteSession,
        updateSettings,
      }}
    >
      {children}
    </BankrollContext.Provider>
  );
}

export function useBankroll(): BankrollContextType {
  return useContext(BankrollContext);
}
