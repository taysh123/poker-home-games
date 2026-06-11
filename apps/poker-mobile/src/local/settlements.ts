/**
 * Local settlement engine — TypeScript port of the backend's
 * SettlementCalculatorService.cs (greedy two-pointer debt minimization).
 *
 * Semantics must stay in sync with the C# implementation:
 * - Debtors sorted ascending (most negative first), creditors descending.
 * - Each transfer = min(|debt|, credit); advance a pointer when its balance hits zero.
 *
 * Divergence note: the backend works in C# `decimal` with Math.Round(amount, 2)
 * (banker's rounding) per transfer and a |balance| < 0.01 pointer threshold.
 * This port works in INTEGER CENTS, so transfers are exact by construction and
 * no rounding or epsilon is needed. Shared test fixtures avoid half-cent ties,
 * so both implementations agree on every fixture.
 *
 * In local games every player is an unlinked guest — there are no digital
 * settlements, so every transfer is a cash settlement ("Alice pays Bob ₪40").
 */

import type { LocalGame } from './types';

export interface PlayerBalance {
  playerId: string;
  /** cashOuts − buyIns, in integer cents. Negative = owes money. */
  netCents: number;
}

export interface Transfer {
  fromPlayerId: string;
  toPlayerId: string;
  amountCents: number;
}

/** Net balance per player: sum(cashout txns) − sum(buyin txns), in cents. */
export function computeBalances(game: Pick<LocalGame, 'players' | 'txns'>): PlayerBalance[] {
  return game.players.map(player => {
    let netCents = 0;
    for (const txn of game.txns) {
      if (txn.playerId !== player.id) continue;
      netCents += txn.kind === 'cashout' ? txn.amountCents : -txn.amountCents;
    }
    return { playerId: player.id, netCents };
  });
}

/**
 * Greedy two-pointer pairing. Returns the minimal-count list of transfers
 * that settles all balances. Deterministic: ties in balance are broken by
 * playerId so the same input always yields the same output.
 */
export function calculateSettlements(balances: PlayerBalance[]): Transfer[] {
  const byAmountThenId = (direction: 1 | -1) => (a: PlayerBalance, b: PlayerBalance) =>
    a.netCents !== b.netCents
      ? (a.netCents - b.netCents) * direction
      : a.playerId.localeCompare(b.playerId);

  const debtors = balances
    .filter(b => b.netCents < 0)
    .map(b => ({ ...b }))
    .sort(byAmountThenId(1)); // most negative first

  const creditors = balances
    .filter(b => b.netCents > 0)
    .map(b => ({ ...b }))
    .sort(byAmountThenId(-1)); // most positive first

  const transfers: Transfer[] = [];

  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];

    const amountCents = Math.min(-debtor.netCents, creditor.netCents);

    if (amountCents > 0) {
      transfers.push({
        fromPlayerId: debtor.playerId,
        toPlayerId: creditor.playerId,
        amountCents,
      });
    }

    debtor.netCents += amountCents;
    creditor.netCents -= amountCents;

    if (debtor.netCents === 0) d++;
    if (creditor.netCents === 0) c++;
  }

  return transfers;
}

/** Convenience: balances + transfers for a game in one call. */
export function settleGame(game: Pick<LocalGame, 'players' | 'txns'>): {
  balances: PlayerBalance[];
  transfers: Transfer[];
} {
  const balances = computeBalances(game);
  return { balances, transfers: calculateSettlements(balances) };
}
