import { blindClock, blindLevelAt } from '../blinds';
import {
  createGame,
  eliminatePlayer,
  emptyFile,
  loadFile,
  saveFile,
  undoElimination,
} from '../localGamesStore';
import {
  payoutAmountsCents,
  prizePoolCents,
  remainingPlayerIds,
  tournamentResult,
} from '../tournament';
import type { LocalGame, LocalGamesFile } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-crypto', () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

const newTournament = (entryCents = 5000, preset: '100' | '60-40' | '50-30-20' = '50-30-20') => {
  const { file, game } = createGame(emptyFile(), {
    name: 'Friday Showdown',
    playerNames: ['Alice', 'Bob', 'Carol'],
    mode: 'tournament',
    tournament: { entryFeeCents: entryCents, payoutPreset: preset, blindPreset: 'standard' },
  });
  return { file, gameId: game.id, playerIds: game.players.map(p => p.id) };
};

beforeEach(() => (AsyncStorage as any).clear());

describe('tournament creation', () => {
  it('records an entry buy-in per player at creation', () => {
    const { file, playerIds } = newTournament(5000);
    const game = file.games[0];
    expect(game.mode).toBe('tournament');
    expect(game.txns).toHaveLength(3);
    expect(prizePoolCents(game)).toBe(15000);
    expect(remainingPlayerIds(game)).toEqual(playerIds);
  });

  it('rejects tournaments without a positive entry fee', () => {
    expect(() =>
      createGame(emptyFile(), {
        name: 'Bad',
        playerNames: ['A', 'B'],
        mode: 'tournament',
        tournament: { entryFeeCents: 0, payoutPreset: '100', blindPreset: 'turbo' },
      }),
    ).toThrow('positive entry fee');
  });
});

describe('payoutAmountsCents (largest remainder)', () => {
  it('splits exactly on clean pools', () => {
    expect(payoutAmountsCents(20000, '50-30-20')).toEqual([10000, 6000, 4000]);
    expect(payoutAmountsCents(10000, '60-40')).toEqual([6000, 4000]);
    expect(payoutAmountsCents(10000, '100')).toEqual([10000]);
  });

  it('always sums to the pool when percentages do not divide evenly', () => {
    const payouts = payoutAmountsCents(10001, '50-30-20');
    expect(payouts.reduce((s, n) => s + n, 0)).toBe(10001);
    expect(payouts[0]).toBeGreaterThanOrEqual(payouts[1]);
    expect(payouts[1]).toBeGreaterThanOrEqual(payouts[2]);
  });

  it('handles tiny pools without losing cents', () => {
    expect(payoutAmountsCents(1, '50-30-20').reduce((s, n) => s + n, 0)).toBe(1);
  });
});

describe('eliminations', () => {
  it('assigns positions bottom-up and auto-finishes on last man standing', () => {
    const { file, gameId, playerIds } = newTournament();
    let next = eliminatePlayer(file, gameId, playerIds[2]); // Carol busts → 3rd
    expect(next.games[0].status).toBe('Active');
    expect(next.games[0].tournament!.eliminations).toEqual([
      expect.objectContaining({ playerId: playerIds[2], position: 3 }),
    ]);

    next = eliminatePlayer(next, gameId, playerIds[1]); // Bob busts → 2nd, Alice auto-wins
    const game = next.games[0];
    expect(game.status).toBe('Finished');
    expect(game.endedAt).toBeDefined();
    const positions = Object.fromEntries(
      game.tournament!.eliminations.map(e => [e.playerId, e.position]),
    );
    expect(positions[playerIds[0]]).toBe(1);
    expect(positions[playerIds[1]]).toBe(2);
    expect(positions[playerIds[2]]).toBe(3);
  });

  it('rejects double elimination and unknown players', () => {
    const { file, gameId, playerIds } = newTournament();
    const next = eliminatePlayer(file, gameId, playerIds[2]);
    expect(() => eliminatePlayer(next, gameId, playerIds[2])).toThrow('Already eliminated');
    expect(() => eliminatePlayer(next, gameId, 'nope')).toThrow('Player not in game');
  });

  it('undoes the most recent bust while active', () => {
    const { file, gameId, playerIds } = newTournament();
    let next = eliminatePlayer(file, gameId, playerIds[2]);
    next = undoElimination(next, gameId);
    expect(next.games[0].tournament!.eliminations).toHaveLength(0);
    expect(remainingPlayerIds(next.games[0])).toHaveLength(3);
  });
});

describe('tournamentResult', () => {
  it('computes standings, payouts, and transfers (50-30-20, no rebuys)', () => {
    const { file, gameId, playerIds } = newTournament(5000, '50-30-20');
    let next = eliminatePlayer(file, gameId, playerIds[2]);
    next = eliminatePlayer(next, gameId, playerIds[1]);

    const result = tournamentResult(next.games[0]);
    expect(result.poolCents).toBe(15000);
    expect(result.standings).toEqual([
      { playerId: playerIds[0], position: 1, payoutCents: 7500 },
      { playerId: playerIds[1], position: 2, payoutCents: 4500 },
      { playerId: playerIds[2], position: 3, payoutCents: 3000 },
    ]);
    // Nets: Alice +2500, Bob -500, Carol -2000 → minimal transfers to Alice
    expect(result.transfers).toEqual([
      { fromPlayerId: playerIds[2], toPlayerId: playerIds[0], amountCents: 2000 },
      { fromPlayerId: playerIds[1], toPlayerId: playerIds[0], amountCents: 500 },
    ]);
  });

  it('rebuys grow the pool and the rebuyer pays more', () => {
    const { file, gameId, playerIds } = newTournament(5000, '100');
    // Bob rebuys (uses the normal addBuyIn path in the store; simulate via txn math here)
    const withRebuy: LocalGamesFile = {
      ...file,
      games: file.games.map(g => ({
        ...g,
        txns: [...g.txns, { id: 'rb1', playerId: playerIds[1], kind: 'buyin' as const, amountCents: 5000, at: g.createdAt }],
      })),
    };
    let next = eliminatePlayer(withRebuy, gameId, playerIds[2]);
    next = eliminatePlayer(next, gameId, playerIds[1]);

    const result = tournamentResult(next.games[0]);
    expect(result.poolCents).toBe(20000);
    expect(result.standings[0]).toEqual({ playerId: playerIds[0], position: 1, payoutCents: 20000 });
    // Alice net +15000; Bob contributed 10000, Carol 5000
    expect(result.transfers).toEqual([
      { fromPlayerId: playerIds[1], toPlayerId: playerIds[0], amountCents: 10000 },
      { fromPlayerId: playerIds[2], toPlayerId: playerIds[0], amountCents: 5000 },
    ]);
  });
});

describe('blind clock', () => {
  it('derives the level deterministically from elapsed time', () => {
    const start = '2026-06-12T20:00:00.000Z';
    const t0 = new Date(start).getTime();
    // standard = 15-min levels
    expect(blindClock('standard', start, t0).current.level).toBe(1);
    expect(blindClock('standard', start, t0 + 14 * 60_000).current.level).toBe(1);
    const atLevel2 = blindClock('standard', start, t0 + 16 * 60_000);
    expect(atLevel2.current.level).toBe(2);
    expect(atLevel2.current).toMatchObject({ smallBlind: 50, bigBlind: 100 });
    expect(atLevel2.next).toMatchObject({ smallBlind: 75, bigBlind: 150 });
    expect(atLevel2.secondsRemaining).toBe(14 * 60);
  });

  it('doubles beyond the base table', () => {
    const l13 = blindLevelAt('turbo', 12);
    expect(l13).toMatchObject({ level: 13, smallBlind: 3000, bigBlind: 6000 });
  });
});

describe('schema v1 → v2 migration', () => {
  it('migrates stored v1 files to v2 cash games', async () => {
    const v1 = {
      schemaVersion: 1,
      games: [{
        id: 'old1', schemaVersion: 1, name: 'Old Game', status: 'Finished',
        createdAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T02:00:00.000Z',
        players: [{ id: 'p1', name: 'Al' }], txns: [],
      }],
    };
    await AsyncStorage.setItem('tpoker.localGames.v1', JSON.stringify(v1));
    const loaded = await loadFile();
    expect(loaded.schemaVersion).toBe(2);
    expect(loaded.games[0]).toMatchObject({ schemaVersion: 2, mode: 'cash', name: 'Old Game' });
  });

  it('round-trips v2 tournaments through storage', async () => {
    const { file } = newTournament();
    await saveFile(file);
    const loaded = await loadFile();
    expect(loaded).toEqual(file);
  });
});
