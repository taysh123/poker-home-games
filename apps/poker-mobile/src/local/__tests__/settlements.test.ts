import { calculateSettlements, computeBalances, settleGame } from '../settlements';
import type { LocalGame, LocalTxn } from '../types';

/**
 * Fixtures mirror the backend SettlementCalculatorService.cs semantics.
 * Values avoid half-cent ties so the C# (banker's rounding) and TS (integer
 * cents) implementations agree exactly.
 */

let txnId = 0;
const txn = (playerId: string, kind: 'buyin' | 'cashout', amountCents: number): LocalTxn => ({
  id: `t${++txnId}`,
  playerId,
  kind,
  amountCents,
  at: '2026-06-12T20:00:00.000Z',
});

const game = (players: string[], txns: LocalTxn[]): Pick<LocalGame, 'players' | 'txns'> => ({
  players: players.map(id => ({ id, name: id })),
  txns,
});

describe('computeBalances', () => {
  it('nets cash-outs against buy-ins per player', () => {
    const g = game(
      ['alice', 'bob'],
      [
        txn('alice', 'buyin', 5000),
        txn('alice', 'cashout', 9000),
        txn('bob', 'buyin', 5000),
        txn('bob', 'cashout', 1000),
      ],
    );
    expect(computeBalances(g)).toEqual([
      { playerId: 'alice', netCents: 4000 },
      { playerId: 'bob', netCents: -4000 },
    ]);
  });

  it('counts multiple buy-ins (rebuys)', () => {
    const g = game(
      ['alice'],
      [txn('alice', 'buyin', 5000), txn('alice', 'buyin', 5000), txn('alice', 'cashout', 2500)],
    );
    expect(computeBalances(g)).toEqual([{ playerId: 'alice', netCents: -7500 }]);
  });

  it('returns zero for players with no transactions', () => {
    expect(computeBalances(game(['alice'], []))).toEqual([{ playerId: 'alice', netCents: 0 }]);
  });
});

describe('calculateSettlements', () => {
  it('settles a simple two-player game with one transfer', () => {
    const transfers = calculateSettlements([
      { playerId: 'alice', netCents: 4000 },
      { playerId: 'bob', netCents: -4000 },
    ]);
    expect(transfers).toEqual([{ fromPlayerId: 'bob', toPlayerId: 'alice', amountCents: 4000 }]);
  });

  it('settles a zero-sum three-player game', () => {
    const transfers = calculateSettlements([
      { playerId: 'alice', netCents: 7000 },
      { playerId: 'bob', netCents: -3000 },
      { playerId: 'carol', netCents: -4000 },
    ]);
    // carol owes most → pays first; then bob
    expect(transfers).toEqual([
      { fromPlayerId: 'carol', toPlayerId: 'alice', amountCents: 4000 },
      { fromPlayerId: 'bob', toPlayerId: 'alice', amountCents: 3000 },
    ]);
    const total = transfers.reduce((s, t) => s + t.amountCents, 0);
    expect(total).toBe(7000);
  });

  it('returns no transfers when everyone is even', () => {
    expect(
      calculateSettlements([
        { playerId: 'alice', netCents: 0 },
        { playerId: 'bob', netCents: 0 },
      ]),
    ).toEqual([]);
  });

  it('one winner, many losers → each loser pays the winner once', () => {
    const transfers = calculateSettlements([
      { playerId: 'winner', netCents: 9000 },
      { playerId: 'l1', netCents: -5000 },
      { playerId: 'l2', netCents: -2500 },
      { playerId: 'l3', netCents: -1500 },
    ]);
    expect(transfers).toEqual([
      { fromPlayerId: 'l1', toPlayerId: 'winner', amountCents: 5000 },
      { fromPlayerId: 'l2', toPlayerId: 'winner', amountCents: 2500 },
      { fromPlayerId: 'l3', toPlayerId: 'winner', amountCents: 1500 },
    ]);
  });

  it('many winners, one loser → loser pays each winner', () => {
    const transfers = calculateSettlements([
      { playerId: 'w1', netCents: 6000 },
      { playerId: 'w2', netCents: 1000 },
      { playerId: 'loser', netCents: -7000 },
    ]);
    expect(transfers).toEqual([
      { fromPlayerId: 'loser', toPlayerId: 'w1', amountCents: 6000 },
      { fromPlayerId: 'loser', toPlayerId: 'w2', amountCents: 1000 },
    ]);
  });

  it('produces at most (n − 1) transfers', () => {
    const transfers = calculateSettlements([
      { playerId: 'a', netCents: 1234 },
      { playerId: 'b', netCents: 5678 },
      { playerId: 'c', netCents: -2345 },
      { playerId: 'd', netCents: -3456 },
      { playerId: 'e', netCents: -1111 },
    ]);
    expect(transfers.length).toBeLessThanOrEqual(4);
    // conservation: total paid equals total received equals total credit
    const paid = transfers.reduce((s, t) => s + t.amountCents, 0);
    expect(paid).toBe(1234 + 5678);
  });

  it('handles non-zero-sum games (chips left on the table) without crashing', () => {
    // Total cash-outs < total buy-ins by 500: debtors owe more than creditors
    // are owed. Mirrors the backend: leftover debt simply goes unpaired.
    const transfers = calculateSettlements([
      { playerId: 'alice', netCents: 2000 },
      { playerId: 'bob', netCents: -2500 },
    ]);
    expect(transfers).toEqual([{ fromPlayerId: 'bob', toPlayerId: 'alice', amountCents: 2000 }]);
  });

  it('is deterministic when balances tie (ordered by playerId)', () => {
    const balances = [
      { playerId: 'zed', netCents: -1000 },
      { playerId: 'amy', netCents: -1000 },
      { playerId: 'win', netCents: 2000 },
    ];
    const a = calculateSettlements(balances);
    const b = calculateSettlements([...balances].reverse());
    expect(a).toEqual(b);
    expect(a[0].fromPlayerId).toBe('amy'); // tie broken alphabetically
  });

  it('handles large amounts without precision loss', () => {
    const transfers = calculateSettlements([
      { playerId: 'a', netCents: 123_456_789 },
      { playerId: 'b', netCents: -123_456_789 },
    ]);
    expect(transfers[0].amountCents).toBe(123_456_789);
  });
});

describe('settleGame', () => {
  it('full game: buy-ins, rebuys, final stacks as cash-outs', () => {
    const g = game(
      ['alice', 'bob', 'carol'],
      [
        txn('alice', 'buyin', 5000),
        txn('bob', 'buyin', 5000),
        txn('carol', 'buyin', 5000),
        txn('bob', 'buyin', 5000), // rebuy
        // final stacks recorded as cash-outs (mirrors backend EndSession)
        txn('alice', 'cashout', 12500),
        txn('bob', 'cashout', 6000),
        txn('carol', 'cashout', 1500),
      ],
    );
    const { balances, transfers } = settleGame(g);
    expect(balances).toEqual([
      { playerId: 'alice', netCents: 7500 },
      { playerId: 'bob', netCents: -4000 },
      { playerId: 'carol', netCents: -3500 },
    ]);
    expect(transfers).toEqual([
      { fromPlayerId: 'bob', toPlayerId: 'alice', amountCents: 4000 },
      { fromPlayerId: 'carol', toPlayerId: 'alice', amountCents: 3500 },
    ]);
  });
});
