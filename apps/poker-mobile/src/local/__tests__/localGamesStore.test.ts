import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addBuyIn,
  addCashOut,
  addPlayer,
  createGame,
  deleteGame,
  emptyFile,
  endGame,
  loadFile,
  saveFile,
  undoLastTxn,
} from '../localGamesStore';
import { computeLocalStats } from '../localStats';
import type { LocalGamesFile } from '../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-crypto is a native module; tests only need unique ids.
jest.mock('expo-crypto', () => {
  let counter = 0;
  return { randomUUID: () => `uuid-${++counter}` };
});

const STORAGE_KEY = 'tpoker.localGames.v1';

const newGameFile = (): { file: LocalGamesFile; gameId: string; playerIds: string[] } => {
  const { file, game } = createGame(emptyFile(), {
    name: 'Friday Night',
    playerNames: ['Alice', 'Bob', 'Carol'],
    defaultBuyInCents: 5000,
  });
  return { file, gameId: game.id, playerIds: game.players.map(p => p.id) };
};

beforeEach(() => (AsyncStorage as any).clear());

describe('createGame', () => {
  it('creates an Active game with players and no transactions', () => {
    const { file } = newGameFile();
    expect(file.games).toHaveLength(1);
    const game = file.games[0];
    expect(game.status).toBe('Active');
    expect(game.players.map(p => p.name)).toEqual(['Alice', 'Bob', 'Carol']);
    expect(game.txns).toEqual([]);
    expect(game.schemaVersion).toBe(2);
  });

  it('rejects a second concurrent active game', () => {
    const { file } = newGameFile();
    expect(() => createGame(file, { name: 'Another', playerNames: ['X'] })).toThrow(
      'already in progress',
    );
  });

  it('trims names', () => {
    const { file } = createGame(emptyFile(), { name: '  Game  ', playerNames: ['  Al  '] });
    expect(file.games[0].name).toBe('Game');
    expect(file.games[0].players[0].name).toBe('Al');
  });
});

describe('transactions', () => {
  it('records buy-ins and cash-outs', () => {
    const { file, gameId, playerIds } = newGameFile();
    let next = addBuyIn(file, gameId, playerIds[0], 5000);
    next = addCashOut(next, gameId, playerIds[0], 2000);
    const txns = next.games[0].txns;
    expect(txns).toHaveLength(2);
    expect(txns[0]).toMatchObject({ kind: 'buyin', amountCents: 5000 });
    expect(txns[1]).toMatchObject({ kind: 'cashout', amountCents: 2000 });
  });

  it('rejects non-positive and fractional amounts', () => {
    const { file, gameId, playerIds } = newGameFile();
    expect(() => addBuyIn(file, gameId, playerIds[0], 0)).toThrow();
    expect(() => addBuyIn(file, gameId, playerIds[0], -100)).toThrow();
    expect(() => addBuyIn(file, gameId, playerIds[0], 50.5)).toThrow();
  });

  it('rejects transactions for unknown players or games', () => {
    const { file, gameId } = newGameFile();
    expect(() => addBuyIn(file, gameId, 'nope', 5000)).toThrow('Player not in game');
    expect(() => addBuyIn(file, 'nope', 'x', 5000)).toThrow('Game not found');
  });

  it('undoLastTxn removes only the most recent transaction', () => {
    const { file, gameId, playerIds } = newGameFile();
    let next = addBuyIn(file, gameId, playerIds[0], 5000);
    next = addBuyIn(next, gameId, playerIds[1], 3000);
    next = undoLastTxn(next, gameId);
    expect(next.games[0].txns).toHaveLength(1);
    expect(next.games[0].txns[0].playerId).toBe(playerIds[0]);
    // undo on empty is a no-op
    next = undoLastTxn(undoLastTxn(next, gameId), gameId);
    expect(next.games[0].txns).toHaveLength(0);
  });
});

describe('addPlayer mid-game', () => {
  it('adds a player to an active game', () => {
    const { file, gameId } = newGameFile();
    const { file: next, player } = addPlayer(file, gameId, 'Dave');
    expect(next.games[0].players).toHaveLength(4);
    expect(player.name).toBe('Dave');
  });
});

describe('endGame', () => {
  it('records final stacks as cash-outs and marks Finished', () => {
    const { file, gameId, playerIds } = newGameFile();
    let next = addBuyIn(file, gameId, playerIds[0], 5000);
    next = addBuyIn(next, gameId, playerIds[1], 5000);
    next = endGame(next, gameId, [
      { playerId: playerIds[0], amountCents: 8000 },
      { playerId: playerIds[1], amountCents: 2000 },
      { playerId: playerIds[2], amountCents: 0 }, // busted → skipped
    ]);
    const game = next.games[0];
    expect(game.status).toBe('Finished');
    expect(game.endedAt).toBeDefined();
    const cashouts = game.txns.filter(t => t.kind === 'cashout');
    expect(cashouts).toHaveLength(2);
    expect(cashouts.map(t => t.amountCents)).toEqual([8000, 2000]);
  });

  it('rejects further mutations after finish', () => {
    const { file, gameId, playerIds } = newGameFile();
    const finished = endGame(file, gameId, []);
    expect(() => addBuyIn(finished, gameId, playerIds[0], 5000)).toThrow('not active');
    expect(() => endGame(finished, gameId, [])).toThrow('not active');
  });
});

describe('deleteGame', () => {
  it('removes the game', () => {
    const { file, gameId } = newGameFile();
    expect(deleteGame(file, gameId).games).toHaveLength(0);
  });
});

describe('persistence', () => {
  it('round-trips through AsyncStorage', async () => {
    const { file } = newGameFile();
    await saveFile(file);
    const loaded = await loadFile();
    expect(loaded).toEqual(file);
  });

  it('returns empty file when nothing stored', async () => {
    expect(await loadFile()).toEqual(emptyFile());
  });

  it('quarantines corrupt payloads instead of clearing them', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{not json!!');
    const loaded = await loadFile();
    expect(loaded).toEqual(emptyFile());
    const keys = await AsyncStorage.getAllKeys();
    const quarantined = keys.filter(k => k.startsWith('tpoker.localGames.quarantine.'));
    expect(quarantined).toHaveLength(1);
    expect(await AsyncStorage.getItem(quarantined[0])).toBe('{not json!!');
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('quarantines valid JSON with unexpected shape', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }));
    expect(await loadFile()).toEqual(emptyFile());
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some(k => k.startsWith('tpoker.localGames.quarantine.'))).toBe(true);
  });
});

describe('computeLocalStats', () => {
  it('derives stats from finished games only', () => {
    const { file, gameId, playerIds } = newGameFile();
    let next = addBuyIn(file, gameId, playerIds[0], 5000);
    next = addBuyIn(next, gameId, playerIds[1], 5000);
    next = endGame(next, gameId, [
      { playerId: playerIds[0], amountCents: 9000 },
      { playerId: playerIds[1], amountCents: 1000 },
    ]);

    const stats = computeLocalStats(next.games);
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.totalMoneyMovedCents).toBe(10000);
    expect(stats.biggestWinCents).toBe(4000);
    expect(stats.biggestWinPlayerName).toBe('Alice');
    expect(stats.recentResults[0]).toMatchObject({
      name: 'Friday Night',
      playerCount: 3,
      totalPotCents: 10000,
      winnerName: 'Alice',
      winnerNetCents: 4000,
    });
  });

  it('ignores active games and handles empty input', () => {
    const { file } = newGameFile();
    expect(computeLocalStats(file.games).gamesPlayed).toBe(0);
    expect(computeLocalStats([]).gamesPlayed).toBe(0);
  });
});
