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
import {
  eliminatePlayer as eliminateInGame,
  finishWithRanking,
  undoElimination as undoInGame,
  PAYOUT_PRESETS,
} from './tournament';
import {
  generateBlindLevels,
  gotoLevel,
  initClock,
  pauseClock,
  resumeClock,
  tickAutoAdvance,
} from './blinds';
import type {
  BlindLevel,
  LocalGame,
  LocalGamesFile,
  LocalPlayer,
  LocalTxn,
  LocalTxnKind,
  LocalTxnTag,
} from './types';

const STORAGE_KEY = 'tpoker.localGames.v1';
const QUARANTINE_PREFIX = 'tpoker.localGames.quarantine.';

export const emptyFile = (): LocalGamesFile => ({ schemaVersion: 4, games: [] });

const newId = (): string => Crypto.randomUUID();
const now = (): string => new Date().toISOString();

/** Intermediate (pre-current) file shapes used only while chaining migrations. */
type V2File = { schemaVersion: 2; games: any[] };
type V3File = { schemaVersion: 3; games: any[] };

/** v1 files predate tournaments — every game becomes an explicit cash game (v2 shape). */
function migrateV1toV2(file: { games: unknown[] }): V2File {
  return {
    schemaVersion: 2,
    games: (file.games as any[]).map(g => ({ ...g, schemaVersion: 2, mode: g.mode ?? 'cash' })),
  };
}

/**
 * v2 → v3: cash games just bump. v2 tournaments had fixed payout/blind presets and
 * a derived clock — convert to explicit payouts[], generated blindLevels[], and a
 * stored clock seeded running from now. New flexibility fields get safe defaults.
 */
function migrateV2toV3(file: { games: any[] }): V3File {
  const nowMs = Date.now();
  return {
    schemaVersion: 3,
    games: file.games.map(g => {
      if (g.mode !== 'tournament' || !g.tournament) {
        return { ...g, schemaVersion: 3 };
      }
      const t = g.tournament;
      // Already v3-shaped (defensive)?
      if (Array.isArray(t.blindLevels) && Array.isArray(t.payouts) && t.clock) {
        return { ...g, schemaVersion: 3 };
      }
      const blindLevels = generateBlindLevels(t.blindPreset ?? 'standard');
      const payouts = PAYOUT_PRESETS[(t.payoutPreset as keyof typeof PAYOUT_PRESETS)] ?? PAYOUT_PRESETS['50-30-20'];
      return {
        ...g,
        schemaVersion: 3,
        tournament: {
          entryFeeCents: t.entryFeeCents,
          payouts,
          blindLevels,
          clock: initClock(blindLevels, nowMs),
          rebuysAllowed: true,
          addOnsAllowed: false,
          lateRegLevels: 0,
          eliminations: t.eliminations ?? [],
        },
      };
    }),
  };
}

/**
 * v3 → v4: add cloud-sync metadata. `updatedAt` is backfilled to `endedAt ?? createdAt`
 * (the best available "last touched" estimate); `deletedAt` stays undefined. Additive —
 * cash and tournament games migrate identically.
 */
function migrateV3toV4(file: { games: any[] }): LocalGamesFile {
  return {
    schemaVersion: 4,
    games: file.games.map(g => ({
      ...g,
      schemaVersion: 4,
      updatedAt: g.updatedAt ?? g.endedAt ?? g.createdAt,
    })) as LocalGame[],
  };
}

type AnyVersionFile = { schemaVersion: number; games: unknown[] };

function isValidFile(value: unknown): value is AnyVersionFile {
  if (typeof value !== 'object' || value === null) return false;
  const file = value as { schemaVersion?: number; games?: unknown };
  return (file.schemaVersion === 1 || file.schemaVersion === 2 || file.schemaVersion === 3 || file.schemaVersion === 4)
    && Array.isArray(file.games);
}

function migrateToCurrent(parsed: AnyVersionFile): LocalGamesFile {
  let working: any = parsed;
  if (working.schemaVersion === 1) working = migrateV1toV2(working);
  if (working.schemaVersion === 2) working = migrateV2toV3(working);
  if (working.schemaVersion === 3) working = migrateV3toV4(working);
  return working as LocalGamesFile;
}

/**
 * Parse a serialized games file (JSON string) and migrate it to the current schema.
 * Returns null on invalid JSON or unexpected shape — callers treat that as "no usable
 * data" (loadFile quarantines it; cloud sync treats it as an empty cloud copy).
 * Shared by `loadFile` and the cloud-sync service so both use the SAME migration chain.
 */
export function parseStoredFile(raw: string): LocalGamesFile | null {
  try {
    const parsed = JSON.parse(raw);
    if (isValidFile(parsed)) return migrateToCurrent(parsed);
    return null;
  } catch {
    return null;
  }
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

  const parsed = parseStoredFile(raw);
  if (parsed) return parsed;

  // Invalid JSON or unexpected shape → quarantine, don't clear: keep it recoverable.
  try {
    await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // non-critical
  }
  return emptyFile();
}

export async function saveFile(file: LocalGamesFile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

// ---------------------------------------------------------------------------
// Pure mutations — each returns a NEW file; callers persist via saveFile()
// ---------------------------------------------------------------------------

export interface CreateTournamentInput {
  entryFeeCents: number;
  payouts: number[];
  blindLevels: BlindLevel[];
  startingStackChips?: number;
  rebuysAllowed: boolean;
  addOnsAllowed: boolean;
  addOnAmountCents?: number;
  lateRegLevels?: number;
}

export interface CreateGameInput {
  name: string;
  playerNames: string[];
  chipRatio?: number;
  defaultBuyInCents?: number;
  mode?: 'cash' | 'tournament';
  /** Required when mode === 'tournament'. */
  tournament?: CreateTournamentInput;
}

export function createGame(
  file: LocalGamesFile,
  input: CreateGameInput,
): { file: LocalGamesFile; game: LocalGame } {
  // Ignore tombstoned (deleted) records when checking for an in-progress game.
  if (file.games.some(g => g.status === 'Active' && !g.deletedAt)) {
    throw new Error('A local game is already in progress');
  }
  const isTournament = input.mode === 'tournament';
  if (isTournament) {
    const t = input.tournament;
    if (!t || t.entryFeeCents <= 0) throw new Error('Tournaments need a positive entry fee');
    if (!t.blindLevels || t.blindLevels.length === 0) throw new Error('Tournaments need a blind structure');
    if (!t.payouts || t.payouts.length === 0) throw new Error('Tournaments need at least one paid place');
  }
  const createdAt = now();
  const createdAtMs = new Date(createdAt).getTime();
  const players = input.playerNames.map(name => ({ id: newId(), name: name.trim() }));
  // Tournament entries are paid by everyone up front — recorded as buy-ins
  // (tagged 'entry') so the prize pool and future rebuys/add-ons all flow through txns.
  const txns: LocalTxn[] = isTournament
    ? players.map(p => ({
        id: newId(),
        playerId: p.id,
        kind: 'buyin' as const,
        amountCents: input.tournament!.entryFeeCents,
        at: createdAt,
        tag: 'entry' as const,
      }))
    : [];
  const t = input.tournament;
  const game: LocalGame = {
    id: newId(),
    schemaVersion: 4,
    name: input.name.trim(),
    status: 'Active',
    mode: input.mode ?? 'cash',
    tournament: isTournament && t
      ? {
          entryFeeCents: t.entryFeeCents,
          payouts: t.payouts,
          blindLevels: t.blindLevels,
          clock: initClock(t.blindLevels, createdAtMs),
          startingStackChips: t.startingStackChips,
          rebuysAllowed: t.rebuysAllowed,
          addOnsAllowed: t.addOnsAllowed,
          addOnAmountCents: t.addOnAmountCents,
          lateRegLevels: t.lateRegLevels,
          eliminations: [],
        }
      : undefined,
    createdAt,
    updatedAt: createdAt,
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
  return {
    ...file,
    games: file.games.map(g => {
      if (g.id !== gameId) return g;
      const next = update(g);
      // Stamp updatedAt only when the mutation actually changed the game (a no-op
      // update — e.g. undo on an empty stack — returns the same reference and is
      // left untouched, so its sync timestamp stays put).
      return next === g ? g : { ...next, updatedAt: now() };
    }),
  };
}

/** Late registration is open while the current level is within the configured window. */
export function isLateRegOpen(game: LocalGame): boolean {
  const t = game.tournament;
  if (!t || !t.lateRegLevels || t.lateRegLevels <= 0) return false;
  return t.clock.levelIndex < t.lateRegLevels;
}

export function addPlayer(
  file: LocalGamesFile,
  gameId: string,
  name: string,
): { file: LocalGamesFile; player: LocalPlayer } {
  const player: LocalPlayer = { id: newId(), name: name.trim() };
  const next = updateGame(file, gameId, game => {
    if (game.status !== 'Active') throw new Error('Game is not active');
    if (game.mode === 'tournament') {
      if (!isLateRegOpen(game)) throw new Error('Late registration is closed');
      // A late entry pays the entry fee into the pool, tagged as an entry.
      const entry: LocalTxn = {
        id: newId(),
        playerId: player.id,
        kind: 'buyin',
        amountCents: game.tournament!.entryFeeCents,
        at: now(),
        tag: 'entry',
      };
      return { ...game, players: [...game.players, player], txns: [...game.txns, entry] };
    }
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
  tag?: LocalTxnTag,
): LocalGamesFile {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('Amount must be a positive whole number of cents');
  }
  return updateGame(file, gameId, game => {
    if (game.status !== 'Active') throw new Error('Game is not active');
    if (!game.players.some(p => p.id === playerId)) throw new Error('Player not in game');
    const txn: LocalTxn = { id: newId(), playerId, kind, amountCents, at: now(), tag };
    return { ...game, txns: [...game.txns, txn] };
  });
}

export function addBuyIn(
  file: LocalGamesFile,
  gameId: string,
  playerId: string,
  amountCents: number,
  tag?: LocalTxnTag,
): LocalGamesFile {
  return addTxn(file, gameId, playerId, 'buyin', amountCents, tag);
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

// ---------------------------------------------------------------------------
// Tournament mutations
// ---------------------------------------------------------------------------

/** Tournament: bust a player (auto-finishes when one remains). */
export function eliminatePlayer(file: LocalGamesFile, gameId: string, playerId: string): LocalGamesFile {
  return updateGame(file, gameId, game => eliminateInGame(game, playerId));
}

/** Tournament: undo the most recent bust (Active games only). */
export function undoElimination(file: LocalGamesFile, gameId: string): LocalGamesFile {
  return updateGame(file, gameId, game => undoInGame(game));
}

/** Tournament: finish early with a host-supplied ranking of remaining players. */
export function finishTournamentEarly(
  file: LocalGamesFile,
  gameId: string,
  orderedRemainingIds: string[],
): LocalGamesFile {
  return updateGame(file, gameId, game => finishWithRanking(game, orderedRemainingIds));
}

function updateClock(
  file: LocalGamesFile,
  gameId: string,
  update: (game: LocalGame) => LocalGame['tournament'],
): LocalGamesFile {
  return updateGame(file, gameId, game => {
    if (game.mode !== 'tournament' || !game.tournament) throw new Error('Not a tournament');
    if (game.status !== 'Active') return game;
    return { ...game, tournament: update(game) };
  });
}

export function pauseTournamentClock(file: LocalGamesFile, gameId: string, nowMs = Date.now()): LocalGamesFile {
  return updateClock(file, gameId, g => ({ ...g.tournament!, clock: pauseClock(g.tournament!.clock, nowMs) }));
}

export function resumeTournamentClock(file: LocalGamesFile, gameId: string, nowMs = Date.now()): LocalGamesFile {
  return updateClock(file, gameId, g => ({ ...g.tournament!, clock: resumeClock(g.tournament!.clock, nowMs) }));
}

/** Move the blind level by delta (±1), clamped; restarts that level's timer. */
export function gotoTournamentLevel(file: LocalGamesFile, gameId: string, delta: number, nowMs = Date.now()): LocalGamesFile {
  return updateClock(file, gameId, g => {
    const t = g.tournament!;
    return { ...t, clock: gotoLevel(t.clock, t.blindLevels, t.clock.levelIndex + delta, nowMs) };
  });
}

/**
 * Auto-advance the clock to the next level when a running level expires.
 * Returns the SAME file reference when nothing changed (so callers can skip
 * re-renders and writes).
 */
export function syncTournamentClock(file: LocalGamesFile, gameId: string, nowMs: number): LocalGamesFile {
  const game = file.games.find(g => g.id === gameId);
  if (!game || game.mode !== 'tournament' || !game.tournament || game.status !== 'Active') return file;
  const clock = tickAutoAdvance(game.tournament.clock, game.tournament.blindLevels, nowMs);
  if (clock === game.tournament.clock) return file;
  return {
    ...file,
    games: file.games.map(g =>
      g.id === gameId ? { ...g, tournament: { ...g.tournament!, clock }, updatedAt: now() } : g,
    ),
  };
}

/**
 * Delete = TOMBSTONE. We set `deletedAt` (and bump `updatedAt`, via updateGame)
 * but KEEP the record in the array, so the deletion can propagate to other devices
 * on the next cloud sync. Selectors filter tombstones out (`!g.deletedAt`).
 */
export function deleteGame(file: LocalGamesFile, gameId: string): LocalGamesFile {
  return updateGame(file, gameId, game => ({ ...game, deletedAt: now() }));
}
