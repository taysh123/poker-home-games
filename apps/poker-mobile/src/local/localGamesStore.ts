/**
 * Persistence + pure mutation functions for local (guest-mode) games.
 *
 * Design rules:
 * - All mutation functions are PURE (game file in → new game file out) so they
 *   are unit-testable without React or AsyncStorage.
 * - Amounts are integer cents everywhere (see settlements.ts).
 * - On unreadable/corrupt storage we QUARANTINE the raw payload under a
 *   timestamped key and start fresh — never silently destroy user data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { LocalGame, LocalGamesFile, LocalPlayer, LocalTxn, LocalTxnKind } from './types';

const STORAGE_KEY = 'tpoker.localGames.v1';
const QUARANTINE_PREFIX = 'tpoker.localGames.quarantine.';

export const emptyFile = (): LocalGamesFile => ({ schemaVersion: 1, games: [] });

const newId = (): string => Crypto.randomUUID();
const now = (): string => new Date().toISOString();

function isValidFile(value: unknown): value is LocalGamesFile {
  if (typeof value !== 'object' || value === null) return false;
  const file = value as LocalGamesFile;
  return file.schemaVersion === 1 && Array.isArray(file.games);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function loadFile(): Promise<LocalGamesFile> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyFile();
  }
  if (!raw) return emptyFile();

  try {
    const parsed = JSON.parse(raw);
    if (isValidFile(parsed)) return parsed;
    throw new Error('unexpected shape');
  } catch {
    // Quarantine, don't clear: keep the raw payload recoverable.
    try {
      await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // non-critical
    }
    return emptyFile();
  }
}

export async function saveFile(file: LocalGamesFile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

// ---------------------------------------------------------------------------
// Pure mutations — each returns a NEW file; callers persist via saveFile()
// ---------------------------------------------------------------------------

export interface CreateGameInput {
  name: string;
  playerNames: string[];
  chipRatio?: number;
  defaultBuyInCents?: number;
}

export function createGame(
  file: LocalGamesFile,
  input: CreateGameInput,
): { file: LocalGamesFile; game: LocalGame } {
  if (file.games.some(g => g.status === 'Active')) {
    throw new Error('A local game is already in progress');
  }
  const game: LocalGame = {
    id: newId(),
    schemaVersion: 1,
    name: input.name.trim(),
    status: 'Active',
    createdAt: now(),
    chipRatio: input.chipRatio,
    defaultBuyInCents: input.defaultBuyInCents,
    players: input.playerNames.map(name => ({ id: newId(), name: name.trim() })),
    txns: [],
  };
  return { file: { ...file, games: [game, ...file.games] }, game };
}

function updateGame(
  file: LocalGamesFile,
  gameId: string,
  update: (game: LocalGame) => LocalGame,
): LocalGamesFile {
  const game = file.games.find(g => g.id === gameId);
  if (!game) throw new Error('Game not found');
  return { ...file, games: file.games.map(g => (g.id === gameId ? update(g) : g)) };
}

export function addPlayer(
  file: LocalGamesFile,
  gameId: string,
  name: string,
): { file: LocalGamesFile; player: LocalPlayer } {
  const player: LocalPlayer = { id: newId(), name: name.trim() };
  const next = updateGame(file, gameId, game => {
    if (game.status !== 'Active') throw new Error('Game is not active');
    return { ...game, players: [...game.players, player] };
  });
  return { file: next, player };
}

function addTxn(
  file: LocalGamesFile,
  gameId: string,
  playerId: string,
  kind: LocalTxnKind,
  amountCents: number,
): LocalGamesFile {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('Amount must be a positive whole number of cents');
  }
  return updateGame(file, gameId, game => {
    if (game.status !== 'Active') throw new Error('Game is not active');
    if (!game.players.some(p => p.id === playerId)) throw new Error('Player not in game');
    const txn: LocalTxn = { id: newId(), playerId, kind, amountCents, at: now() };
    return { ...game, txns: [...game.txns, txn] };
  });
}

export function addBuyIn(
  file: LocalGamesFile,
  gameId: string,
  playerId: string,
  amountCents: number,
): LocalGamesFile {
  return addTxn(file, gameId, playerId, 'buyin', amountCents);
}

export function addCashOut(
  file: LocalGamesFile,
  gameId: string,
  playerId: string,
  amountCents: number,
): LocalGamesFile {
  return addTxn(file, gameId, playerId, 'cashout', amountCents);
}

export function undoLastTxn(file: LocalGamesFile, gameId: string): LocalGamesFile {
  return updateGame(file, gameId, game => {
    if (game.status !== 'Active') throw new Error('Game is not active');
    if (game.txns.length === 0) return game;
    return { ...game, txns: game.txns.slice(0, -1) };
  });
}

/**
 * Ends the game. Final stacks are recorded as cash-out transactions —
 * mirroring the backend's EndSessionCommandHandler semantics. Zero stacks
 * (busted players) are skipped, like the backend skips zero cash-outs.
 */
export function endGame(
  file: LocalGamesFile,
  gameId: string,
  finalStacks: { playerId: string; amountCents: number }[],
): LocalGamesFile {
  return updateGame(file, gameId, game => {
    if (game.status !== 'Active') throw new Error('Game is not active');
    const endedAt = now();
    const stackTxns: LocalTxn[] = finalStacks
      .filter(s => s.amountCents > 0)
      .map(s => {
        if (!Number.isInteger(s.amountCents) || s.amountCents < 0) {
          throw new Error('Final stack must be a non-negative whole number of cents');
        }
        if (!game.players.some(p => p.id === s.playerId)) throw new Error('Player not in game');
        return { id: newId(), playerId: s.playerId, kind: 'cashout' as const, amountCents: s.amountCents, at: endedAt };
      });
    return { ...game, status: 'Finished', endedAt, txns: [...game.txns, ...stackTxns] };
  });
}

export function deleteGame(file: LocalGamesFile, gameId: string): LocalGamesFile {
  if (!file.games.some(g => g.id === gameId)) throw new Error('Game not found');
  return { ...file, games: file.games.filter(g => g.id !== gameId) };
}
