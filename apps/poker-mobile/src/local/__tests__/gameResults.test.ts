import { buildGameResults } from '../gameResults';
import type { LocalGame } from '../types';

const T = '2026-07-20T20:00:00.000Z';

/** Finished cash game: Alex +₪10, Dana −₪10; ₪40 in buy-ins. */
const cashGame: LocalGame = {
  id: 'c1', schemaVersion: 4, name: 'Cash', status: 'Finished', mode: 'cash',
  createdAt: T, endedAt: T, updatedAt: T,
  players: [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Dana' }],
  txns: [
    { id: '1', playerId: 'a', kind: 'buyin', amountCents: 2000, at: T },
    { id: '2', playerId: 'b', kind: 'buyin', amountCents: 2000, at: T },
    { id: '3', playerId: 'a', kind: 'cashout', amountCents: 3000, at: T },
    { id: '4', playerId: 'b', kind: 'cashout', amountCents: 1000, at: T },
  ],
};

/** Finished heads-up tournament: Alex wins the ₪40 pool (winner-take-all), Dana busts 2nd. */
const tourGame: LocalGame = {
  id: 't1', schemaVersion: 4, name: 'Tour', status: 'Finished', mode: 'tournament',
  createdAt: T, endedAt: T, updatedAt: T,
  players: [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Dana' }],
  txns: [
    { id: '1', playerId: 'a', kind: 'buyin', amountCents: 2000, at: T, tag: 'entry' },
    { id: '2', playerId: 'b', kind: 'buyin', amountCents: 2000, at: T, tag: 'entry' },
  ],
  tournament: {
    entryFeeCents: 2000,
    payouts: [100],
    blindLevels: [{ smallBlind: 25, bigBlind: 50, durationSeconds: 900 }],
    clock: { status: 'paused', levelIndex: 0, lastResumeMs: 0, remainingMsAtResume: 900_000 },
    rebuysAllowed: false,
    addOnsAllowed: false,
    eliminations: [
      { playerId: 'a', position: 1, at: T },
      { playerId: 'b', position: 2, at: T },
    ],
  },
};

describe('buildGameResults — cash', () => {
  it('ranks players by net (desc), sums buy-ins, and computes settlements; no podium', () => {
    const r = buildGameResults(cashGame);
    expect(r.podium).toBeNull();
    expect(r.totalPotCents).toBe(4000);
    expect(r.results.map(x => [x.player.name, x.netCents])).toEqual([['Alex', 1000], ['Dana', -1000]]);
    // Dana (−₪10) pays Alex (+₪10) exactly ₪10.
    expect(r.transfers).toEqual([{ fromPlayerId: 'b', toPlayerId: 'a', amountCents: 1000 }]);
  });
});

describe('buildGameResults — tournament', () => {
  it('produces the podium (position asc) with payouts + net, the pool total, and settlements; no cash results', () => {
    const r = buildGameResults(tourGame);
    expect(r.results).toEqual([]);
    expect(r.totalPotCents).toBe(4000); // pool
    expect(r.podium).not.toBeNull();
    expect(r.podium!.map(x => [x.player.name, x.position, x.payoutCents, x.netCents])).toEqual([
      ['Alex', 1, 4000, 2000],  // won ₪40, contributed ₪20 ⇒ +₪20
      ['Dana', 2, 0, -2000],    // won nothing, contributed ₪20 ⇒ −₪20
    ]);
    expect(r.transfers).toEqual([{ fromPlayerId: 'b', toPlayerId: 'a', amountCents: 2000 }]);
  });
});
