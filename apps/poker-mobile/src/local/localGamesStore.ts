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
import { eliminatePlayer as eliminateInGame, undoElimination as undoInGame } from './tournament';
import type {
  BlindPreset,
  LocalGame,
  LocalGamesFile,
  LocalPlayer,
  LocalTxn,
  LocalTxnKind,
  PayoutPreset,
} from './types';

const STORAGE_KEY = 'tpoker.localGames.v1';
const QUARANTINE_PREFIX = 'tpoker.localGames.quarantine.';

export const emptyFile = (): LocalGamesFile => ({ schemaVersion: 2, games: [] });

/** v1 files predate tournaments — every game becomes an explicit cash game. */
function migrateV1(file: { games: unknown[] }): LocalGamesFile {
  return {
    schemaVersion: 2,
    games: (file.games as LocalGame[]).map(g => ({ ...g, schemaVersion: 2, mode: g.mode ?? 'cash' })),
  };
}

const newId = (): string => Crypto.randomUUID();
const now = (): string => new Date().toISOString();

type AnyVersionFile = { schemaVersion: number; games: LocalGame[] };

function isValidFile(value: unknown): value is AnyVersionFile {
  if (typeof value !== 'object' || value === null) return false;
  const file = value as { schemaVersion?: number; games?: unknown };
  return (file.schemaVersion === 1 || file.schemaVersion === 2) && Array.isArray(file.games);
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
    if (isValidFile(parsed)) {
      return parsed.schemaVersion === 1 ? migrateV1(parsed) : (parsed as LocalGamesFile);
    }
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
  mode?: 'cash' | 'tournament';
  /** Required when mode === 'tournament'. */
  tournament?: {
    entryFeeCents: number;
    payoutPreset: PayoutPreset;
    blindPreset: BlindPreset;
  };
}

export function createGame(
  file: LocalGamesFile,
  input: CreateGameInput,
): { file: LocalGamesFile; game: LocalGame } {
  if (file.games.some(g => g.status === 'Active')) {
    throw new Error('A local game is already in progress');
  }
  const isTournament = input.mode === 'tournament';
  if (isTournament && (!input.tournament || input.tournament.entryFeeCents <= 0)) {
    throw new Error('Tournaments need a positive entry fee');
  }
  const createdAt = now();
  const players = input.playerNames.map(name => ({ id: newId(), name: name.trim() }));
  // Tournament entries are paid by everyone up front — recorded as buy-ins
  // so the prize pool (and future rebuys via addBuyIn) all flow through txns.
  const txns: LocalTxn[] = isTournament
    ? players.map(p => ({
        id: newId(),
        playerId: p.id,
        kind: 'buyin' as const,
        amountCents: input.tournament!.entryFeeCents,
        at: createdAt,
      }))
    : [];
  const game: LocalGame = {
    id: newId(),
    schemaVersion: 2,
    name: input.name.trim(),
    status: 'Active',
    mode: input.mode ?? 'cash',
    tournament: isTournament
      ? { ...input.tournament!, eliminations: [] }
      : undefined,
    createdAt,
    chipRatio: input.chipRatio,
    defaultBuyInCents: isTournament ? input.tournament!.entryFeeCents : input.defaultBuyInCents,
    players,
    txns,
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

/** Tournament: bust a player (auto-finishes when one remains). */
export function eliminatePlayer(file: LocalGamesFile, gameId: string, playerId: string): LocalGamesFile {
  return updateGame(file, gameId, game => eliminateInGame(game, playerId));
}

/** Tournament: undo the most recent bust (Active games only). */
export function undoElimination(file: LocalGamesFile, gameId: string): LocalGamesFile {
  return updateGame(file, gameId, game => undoInGame(game));
}

export function deleteGame(file: LocalGamesFile, gameId: string): LocalGamesFile {
  if (!file.games.some(g => g.id === gameId)) throw new Error('Game not found');
  return { ...file, games: file.games.filter(g => g.id !== gameId) };
}
