import {
  clockRemainingMs,
  clockView,
  generateBlindLevels,
  gotoLevel,
  initClock,
  levelAt,
  pauseClock,
  resumeClock,
  tickAutoAdvance,
} from '../blinds';
import {
  addPlayer,
  createGame,
  eliminatePlayer,
  emptyFile,
  finishTournamentEarly,
  gotoTournamentLevel,
  isLateRegOpen,
  loadFile,
  pauseTournamentClock,
  resumeTournamentClock,
  saveFile,
  syncTournamentClock,
  undoElimination,
} from '../localGamesStore';
import {
  PAYOUT_PRESETS,
  payoutAmountsCents,
  prizePoolCents,
  remainingPlayerIds,
  tournamentResult,
} from '../tournament';
import type { LocalGamesFile } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-crypto', () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

const newTournament = (
  entryCents = 5000,
  payouts: number[] = PAYOUT_PRESETS['50-30-20'],
  extra: Partial<Parameters<typeof createGame>[1]['tournament'] & object> = {},
) => {
  const { file, game } = createGame(emptyFile(), {
    name: 'Friday Showdown',
    playerNames: ['Alice', 'Bob', 'Carol'],
    mode: 'tournament',
    tournament: {
      entryFeeCents: entryCents,
      payouts,
      blindLevels: generateBlindLevels('standard'),
      rebuysAllowed: true,
      addOnsAllowed: false,
      lateRegLevels: 0,
      ...extra,
    },
  });
  return { file, gameId: game.id, playerIds: game.players.map(p => p.id) };
};

beforeEach(() => (AsyncStorage as any).clear());

describe('tournament creation', () => {
  it('records an entry buy-in per player (tagged) at creation', () => {
    const { file, playerIds } = newTournament(5000);
    const game = file.games[0];
    expect(game.mode).toBe('tournament');
    expect(game.schemaVersion).toBe(3);
    expect(game.txns).toHaveLength(3);
    expect(game.txns.every(t => t.tag === 'entry')).toBe(true);
    expect(prizePoolCents(game)).toBe(15000);
    expect(remainingPlayerIds(game)).toEqual(playerIds);
    // clock seeded running at level 0
    expect(game.tournament!.clock.status).toBe('running');
    expect(game.tournament!.clock.levelIndex).toBe(0);
  });

  it('rejects tournaments without a positive entry fee', () => {
    expect(() =>
      createGame(emptyFile(), {
        name: 'Bad',
        playerNames: ['A', 'B'],
        mode: 'tournament',
        tournament: {
          entryFeeCents: 0,
          payouts: [100],
          blindLevels: generateBlindLevels('turbo'),
          rebuysAllowed: true,
          addOnsAllowed: false,
        },
      }),
    ).toThrow('positive entry fee');
  });
});

describe('payoutAmountsCents (largest remainder, arbitrary distributions)', () => {
  it('splits exactly on clean pools', () => {
    expect(payoutAmountsCents(20000, [50, 30, 20])).toEqual([10000, 6000, 4000]);
    expect(payoutAmountsCents(10000, [60, 40])).toEqual([6000, 4000]);
    expect(payoutAmountsCents(10000, [100])).toEqual([10000]);
  });

  it('supports custom distributions and winner counts', () => {
    expect(payoutAmountsCents(10000, [70, 30])).toEqual([7000, 3000]);
    expect(payoutAmountsCents(10000, [40, 30, 20, 10])).toEqual([4000, 3000, 2000, 1000]);
  });

  it('always sums to the pool when percentages do not divide evenly', () => {
    const payouts = payoutAmountsCents(10001, [50, 30, 20]);
    expect(payouts.reduce((s, n) => s + n, 0)).toBe(10001);
    expect(payouts[0]).toBeGreaterThanOrEqual(payouts[1]);
    expect(payouts[1]).toBeGreaterThanOrEqual(payouts[2]);
  });

  it('handles tiny pools without losing cents', () => {
    expect(payoutAmountsCents(1, [50, 30, 20]).reduce((s, n) => s + n, 0)).toBe(1);
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
    const { file, gameId, playerIds } = newTournament(5000, PAYOUT_PRESETS['50-30-20']);
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
    const { file, gameId, playerIds } = newTournament(5000, PAYOUT_PRESETS['100']);
    const withRebuy: LocalGamesFile = {
      ...file,
      games: file.games.map(g => ({
        ...g,
        txns: [...g.txns, { id: 'rb1', playerId: playerIds[1], kind: 'buyin' as const, amountCents: 5000, at: g.createdAt, tag: 'rebuy' as const }],
      })),
    };
    let next = eliminatePlayer(withRebuy, gameId, playerIds[2]);
    next = eliminatePlayer(next, gameId, playerIds[1]);

    const result = tournamentResult(next.games[0]);
    expect(result.poolCents).toBe(20000);
    expect(result.standings[0]).toEqual({ playerId: playerIds[0], position: 1, payoutCents: 20000 });
    expect(result.transfers).toEqual([
      { fromPlayerId: playerIds[1], toPlayerId: playerIds[0], amountCents: 10000 },
      { fromPlayerId: playerIds[2], toPlayerId: playerIds[0], amountCents: 5000 },
    ]);
  });
});

describe('late registration', () => {
  it('rejects adding a player when the window is closed (default)', () => {
    const { file, gameId } = newTournament();
    expect(isLateRegOpen(file.games[0])).toBe(false);
    expect(() => addPlayer(file, gameId, 'Dave')).toThrow('Late registration is closed');
  });

  it('adds a late entry (with entry buy-in) while the window is open', () => {
    const { file, gameId, playerIds } = newTournament(5000, PAYOUT_PRESETS['50-30-20'], { lateRegLevels: 2 });
    expect(isLateRegOpen(file.games[0])).toBe(true);
    const { file: next } = addPlayer(file, gameId, 'Dave');
    const game = next.games[0];
    expect(game.players).toHaveLength(4);
    expect(prizePoolCents(game)).toBe(20000); // 4 entries
    const dave = game.players[3];
    expect(game.txns.some(t => t.playerId === dave.id && t.tag === 'entry')).toBe(true);
    // late entrant keeps correct position math: first bust = 4th
    const busted = eliminatePlayer(next, gameId, playerIds[0]);
    expect(busted.games[0].tournament!.eliminations[0]).toMatchObject({ position: 4 });
  });
});

describe('finish early with manual ranking', () => {
  it('assigns top positions to remaining players and pays out', () => {
    const { file, gameId, playerIds } = newTournament(5000, PAYOUT_PRESETS['50-30-20']);
    // Carol busts (3rd); Alice + Bob remain. Host ends early ranking Bob over Alice.
    let next = eliminatePlayer(file, gameId, playerIds[2]);
    next = finishTournamentEarly(next, gameId, [playerIds[1], playerIds[0]]);
    const game = next.games[0];
    expect(game.status).toBe('Finished');
    const result = tournamentResult(game);
    expect(result.standings).toEqual([
      { playerId: playerIds[1], position: 1, payoutCents: 7500 },
      { playerId: playerIds[0], position: 2, payoutCents: 4500 },
      { playerId: playerIds[2], position: 3, payoutCents: 3000 },
    ]);
  });

  it('rejects an incomplete ranking', () => {
    const { file, gameId, playerIds } = newTournament();
    expect(() => finishTournamentEarly(file, gameId, [playerIds[0]])).toThrow('every remaining player');
  });
});

describe('blind structure + stored clock', () => {
  const levels = generateBlindLevels('standard'); // 15-min levels

  it('generates a structure and clamps levelAt past the end', () => {
    expect(levels[0]).toMatchObject({ smallBlind: 25, bigBlind: 50, durationSeconds: 900 });
    expect(levels[1]).toMatchObject({ smallBlind: 50, bigBlind: 100 });
    expect(levelAt(levels, 999)).toBe(levels[levels.length - 1]);
  });

  it('counts down, pauses (freezes), and resumes', () => {
    const t0 = 1_000_000;
    let clock = initClock(levels, t0);
    expect(clockRemainingMs(clock, t0)).toBe(900_000);
    expect(clockRemainingMs(clock, t0 + 60_000)).toBe(840_000);
    // pause at +60s → frozen at 840s remaining regardless of wall clock
    clock = pauseClock(clock, t0 + 60_000);
    expect(clockRemainingMs(clock, t0 + 5_000_000)).toBe(840_000);
    // resume later → keeps counting from 840s
    clock = resumeClock(clock, t0 + 5_000_000);
    expect(clockRemainingMs(clock, t0 + 5_060_000)).toBe(780_000);
  });

  it('jumps levels manually and auto-advances at expiry', () => {
    const t0 = 2_000_000;
    let clock = initClock(levels, t0);
    clock = gotoLevel(clock, levels, 2, t0);
    expect(clock.levelIndex).toBe(2);
    expect(clockRemainingMs(clock, t0)).toBe(900_000);
    // run to expiry → auto-advance to level 3
    const expired = tickAutoAdvance(clock, levels, t0 + 900_000);
    expect(expired.levelIndex).toBe(3);
    // a non-expired tick is a no-op (same reference)
    expect(tickAutoAdvance(clock, levels, t0 + 10_000)).toBe(clock);
  });

  it('store clock mutations pause/resume/goto and sync', () => {
    const { file, gameId } = newTournament();
    const t0 = new Date(file.games[0].createdAt).getTime();
    let next = pauseTournamentClock(file, gameId, t0 + 1000);
    expect(next.games[0].tournament!.clock.status).toBe('paused');
    next = resumeTournamentClock(next, gameId, t0 + 2000);
    expect(next.games[0].tournament!.clock.status).toBe('running');
    next = gotoTournamentLevel(next, gameId, +1, t0 + 3000);
    expect(next.games[0].tournament!.clock.levelIndex).toBe(1);
    // sync before expiry is a no-op
    const same = syncTournamentClock(next, gameId, t0 + 4000);
    expect(same).toBe(next);
  });

  it('clockView reports level number, blinds, next, and paused state', () => {
    const t0 = 3_000_000;
    const clock = initClock(levels, t0);
    const view = clockView(clock, levels, t0);
    expect(view.levelNumber).toBe(1);
    expect(view.current).toMatchObject({ smallBlind: 25, bigBlind: 50 });
    expect(view.next).toMatchObject({ smallBlind: 50, bigBlind: 100 });
    expect(view.paused).toBe(false);
    expect(view.secondsRemaining).toBe(900);
  });
});

describe('schema migration', () => {
  it('migrates stored v1 files to v3 cash games', async () => {
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
    expect(loaded.schemaVersion).toBe(3);
    expect(loaded.games[0]).toMatchObject({ schemaVersion: 3, mode: 'cash', name: 'Old Game' });
  });

  it('migrates v2 tournaments (preset → payouts[] + blindLevels[] + clock)', async () => {
    const v2 = {
      schemaVersion: 2,
      games: [{
        id: 't1', schemaVersion: 2, name: 'Old T', status: 'Active', mode: 'tournament',
        createdAt: '2026-06-01T20:00:00.000Z',
        players: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }],
        txns: [
          { id: 'x1', playerId: 'p1', kind: 'buyin', amountCents: 5000, at: '2026-06-01T20:00:00.000Z' },
          { id: 'x2', playerId: 'p2', kind: 'buyin', amountCents: 5000, at: '2026-06-01T20:00:00.000Z' },
        ],
        tournament: { entryFeeCents: 5000, payoutPreset: '60-40', blindPreset: 'turbo', eliminations: [] },
      }],
    };
    await AsyncStorage.setItem('tpoker.localGames.v1', JSON.stringify(v2));
    const loaded = await loadFile();
    expect(loaded.schemaVersion).toBe(3);
    const t = loaded.games[0].tournament!;
    expect(t.payouts).toEqual([60, 40]);
    expect(t.blindLevels.length).toBeGreaterThan(0);
    expect(t.clock.status).toBe('running');
    expect(t.rebuysAllowed).toBe(true);
    expect(t.lateRegLevels).toBe(0);
  });

  it('round-trips v3 tournaments through storage', async () => {
    const { file } = newTournament();
    await saveFile(file);
    const loaded = await loadFile();
    expect(loaded).toEqual(file);
  });
});
