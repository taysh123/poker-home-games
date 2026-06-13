import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as store from '../local/localGamesStore';
import type { LocalGame, LocalGamesFile, LocalTxnTag } from '../local/types';

/**
 * Thin React wrapper around localGamesStore. Holds the loaded file in state;
 * every action applies a pure mutation, updates state, and persists.
 * Available to guests AND logged-in users (local games are account-independent).
 */

type LocalGamesContextType = {
  games: LocalGame[];
  activeGame: LocalGame | null;
  isLoaded: boolean;
  startGame: (input: store.CreateGameInput) => Promise<LocalGame>;
  addPlayer: (gameId: string, name: string) => Promise<void>;
  addBuyIn: (gameId: string, playerId: string, amountCents: number, tag?: LocalTxnTag) => Promise<void>;
  addCashOut: (gameId: string, playerId: string, amountCents: number) => Promise<void>;
  undoLastTxn: (gameId: string) => Promise<void>;
  endGame: (gameId: string, finalStacks: { playerId: string; amountCents: number }[]) => Promise<void>;
  deleteGame: (gameId: string) => Promise<void>;
  /** Tournament only: bust a player out (auto-finishes on last man standing). */
  eliminatePlayer: (gameId: string, playerId: string) => Promise<void>;
  /** Tournament only: undo the most recent bust. */
  undoElimination: (gameId: string) => Promise<void>;
  /** Tournament only: finish early with a host-supplied ranking of remaining players. */
  finishTournamentEarly: (gameId: string, orderedRemainingIds: string[]) => Promise<void>;
  /** Tournament clock controls. */
  pauseClock: (gameId: string) => Promise<void>;
  resumeClock: (gameId: string) => Promise<void>;
  gotoLevel: (gameId: string, delta: number) => Promise<void>;
  syncClock: (gameId: string, nowMs: number) => Promise<void>;
};

const LocalGamesContext = createContext<LocalGamesContextType>({
  games: [],
  activeGame: null,
  isLoaded: false,
  startGame: async () => { throw new Error('LocalGamesProvider missing'); },
  addPlayer: async () => {},
  addBuyIn: async () => {},
  addCashOut: async () => {},
  undoLastTxn: async () => {},
  endGame: async () => {},
  deleteGame: async () => {},
  eliminatePlayer: async () => {},
  undoElimination: async () => {},
  finishTournamentEarly: async () => {},
  pauseClock: async () => {},
  resumeClock: async () => {},
  gotoLevel: async () => {},
  syncClock: async () => {},
});

export function LocalGamesProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<LocalGamesFile>(store.emptyFile());
  const [isLoaded, setIsLoaded] = useState(false);
  // Serialize persistence so rapid taps can't interleave writes.
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

  const commit = useCallback((next: LocalGamesFile) => {
    setFile(next);
    writeQueue.current = writeQueue.current
      .then(() => store.saveFile(next))
      .catch(() => { /* non-critical: state is source of truth until next save */ });
    return writeQueue.current;
  }, []);

  const startGame = useCallback(async (input: store.CreateGameInput) => {
    const { file: next, game } = store.createGame(file, input);
    await commit(next);
    return game;
  }, [file, commit]);

  const addPlayer = useCallback(async (gameId: string, name: string) => {
    await commit(store.addPlayer(file, gameId, name).file);
  }, [file, commit]);

  const addBuyIn = useCallback(async (gameId: string, playerId: string, amountCents: number, tag?: LocalTxnTag) => {
    await commit(store.addBuyIn(file, gameId, playerId, amountCents, tag));
  }, [file, commit]);

  const addCashOut = useCallback(async (gameId: string, playerId: string, amountCents: number) => {
    await commit(store.addCashOut(file, gameId, playerId, amountCents));
  }, [file, commit]);

  const undoLastTxn = useCallback(async (gameId: string) => {
    await commit(store.undoLastTxn(file, gameId));
  }, [file, commit]);

  const endGame = useCallback(async (gameId: string, finalStacks: { playerId: string; amountCents: number }[]) => {
    await commit(store.endGame(file, gameId, finalStacks));
  }, [file, commit]);

  const deleteGame = useCallback(async (gameId: string) => {
    await commit(store.deleteGame(file, gameId));
  }, [file, commit]);

  const eliminatePlayer = useCallback(async (gameId: string, playerId: string) => {
    await commit(store.eliminatePlayer(file, gameId, playerId));
  }, [file, commit]);

  const undoElimination = useCallback(async (gameId: string) => {
    await commit(store.undoElimination(file, gameId));
  }, [file, commit]);

  const finishTournamentEarly = useCallback(async (gameId: string, orderedRemainingIds: string[]) => {
    await commit(store.finishTournamentEarly(file, gameId, orderedRemainingIds));
  }, [file, commit]);

  const pauseClock = useCallback(async (gameId: string) => {
    await commit(store.pauseTournamentClock(file, gameId));
  }, [file, commit]);

  const resumeClock = useCallback(async (gameId: string) => {
    await commit(store.resumeTournamentClock(file, gameId));
  }, [file, commit]);

  const gotoLevel = useCallback(async (gameId: string, delta: number) => {
    await commit(store.gotoTournamentLevel(file, gameId, delta));
  }, [file, commit]);

  const syncClock = useCallback(async (gameId: string, nowMs: number) => {
    const next = store.syncTournamentClock(file, gameId, nowMs);
    if (next !== file) await commit(next);
  }, [file, commit]);

  const activeGame = file.games.find(g => g.status === 'Active') ?? null;

  return (
    <LocalGamesContext.Provider
      value={{
        games: file.games,
        activeGame,
        isLoaded,
        startGame,
        addPlayer,
        addBuyIn,
        addCashOut,
        undoLastTxn,
        endGame,
        deleteGame,
        eliminatePlayer,
        undoElimination,
        finishTournamentEarly,
        pauseClock,
        resumeClock,
        gotoLevel,
        syncClock,
      }}
    >
      {children}
    </LocalGamesContext.Provider>
  );
}

export function useLocalGames() {
  return useContext(LocalGamesContext);
}
