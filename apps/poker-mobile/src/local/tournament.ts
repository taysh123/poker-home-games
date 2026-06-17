/**
 * Local tournament logic. Pure functions; amounts in integer cents.
 *
 * Payouts reuse the proven settlement engine: each player's net =
 * payout(position) − contributed(entry + rebuys + add-ons), then the greedy
 * calculateSettlements turns nets into minimal "X pays Y" transfers —
 * identical rendering to cash-game settlements.
 */

import { calculateSettlements, type PlayerBalance, type Transfer } from './settlements';
import type { LocalGame, PayoutPreset } from './types';

/** Quick-pick percentage seeds — the live config stores an explicit `payouts[]`. */
export const PAYOUT_PRESETS: Record<PayoutPreset, number[]> = {
  '100': [100],
  '60-40': [60, 40],
  '50-30-20': [50, 30, 20],
};

export const PAYOUT_PRESET_LABELS: Record<PayoutPreset, string> = {
  '100': 'Winner takes all',
  '60-40': '60 / 40',
  '50-30-20': '50 / 30 / 20',
};

/** Entry fees + rebuys + add-ons — every buy-in transaction feeds the pool. */
export function prizePoolCents(game: Pick<LocalGame, 'txns'>): number {
  return game.txns.filter(t => t.kind === 'buyin').reduce((s, t) => s + t.amountCents, 0);
}

export function remainingPlayerIds(game: LocalGame): string[] {
  const busted = new Set((game.tournament?.eliminations ?? []).map(e => e.playerId));
  return game.players.filter(p => !busted.has(p.id)).map(p => p.id);
}

/**
 * Split the pool by percentages using largest-remainder allocation — payouts
 * always sum to the pool exactly, in cents. Accepts any percentage array
 * (presets or a custom distribution); caller guarantees it sums to 100.
 */
export function payoutAmountsCents(poolCents: number, percents: number[]): number[] {
  if (percents.length === 0) return [];
  const raw = percents.map(p => (poolCents * p) / 100);
  const floors = raw.map(Math.floor);
  const remainder = poolCents - floors.reduce((s, n) => s + n, 0);
  // Hand out leftover cents to the largest fractional parts (stable order on tie).
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  const result = [...floors];
  for (let i = 0; i < remainder; i++) result[order[i % order.length].index] += 1;
  return result;
}

/**
 * A sensible DEFAULT payout split for any number of paid places: descending
 * integer percentages that always sum to exactly 100, with every paid place
 * guaranteed at least 1%. Used to seed the wizard for arbitrary winner counts
 * (the user can still edit each row). Gives every place a 1% base, then shares
 * the remainder by descending rank via largest-remainder (same technique as
 * `payoutAmountsCents`).
 */
export function defaultPayoutSplit(n: number): number[] {
  const places = Math.max(1, Math.floor(n));
  if (places === 1) return [100];
  const base = 1; // floor so no paid place is 0%
  const pool = Math.max(0, 100 - base * places); // remainder shared by rank
  const weights = Array.from({ length: places }, (_, i) => places - i); // descending
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map(w => (w * pool) / weightSum);
  const floors = raw.map(Math.floor);
  let remainder = pool - floors.reduce((s, v) => s + v, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  const result = floors.map(v => v + base);
  for (let i = 0; remainder > 0; i++, remainder--) result[order[i % order.length].index] += 1;
  return result;
}

/** Cents each player put in (entry + rebuys + add-ons). */
export function contributionCents(game: Pick<LocalGame, 'txns'>, playerId: string): number {
  return game.txns
    .filter(t => t.kind === 'buyin' && t.playerId === playerId)
    .reduce((s, t) => s + t.amountCents, 0);
}

export interface TournamentResult {
  /** position → playerId, 1-based, complete once the game is Finished. */
  standings: { playerId: string; position: number; payoutCents: number }[];
  poolCents: number;
  transfers: Transfer[];
}

/**
 * Final result for a FINISHED tournament: standings with payouts, plus
 * minimal transfers settling who pays whom.
 */
export function tournamentResult(game: LocalGame): TournamentResult {
  const config = game.tournament;
  if (!config) throw new Error('Not a tournament');

  const poolCents = prizePoolCents(game);
  const payouts = payoutAmountsCents(poolCents, config.payouts);

  const positionByPlayer = new Map(config.eliminations.map(e => [e.playerId, e.position]));
  const standings = game.players
    .map(p => {
      const position = positionByPlayer.get(p.id) ?? 0;
      const payoutCents = position >= 1 && position <= payouts.length ? payouts[position - 1] : 0;
      return { playerId: p.id, position, payoutCents };
    })
    .sort((a, b) => a.position - b.position);

  const balances: PlayerBalance[] = standings.map(s => ({
    playerId: s.playerId,
    netCents: s.payoutCents - contributionCents(game, s.playerId),
  }));

  return { standings, poolCents, transfers: calculateSettlements(balances) };
}

/**
 * Bust a player out. Positions assign bottom-up (first bust = last place) using
 * the count of players still in BEFORE this bust, so the math stays correct even
 * when players join via late registration. When one player remains they take
 * position 1 and the game finishes. Returns a NEW game object (pure).
 */
export function eliminatePlayer(game: LocalGame, playerId: string): LocalGame {
  const config = game.tournament;
  if (!config) throw new Error('Not a tournament');
  if (game.status !== 'Active') throw new Error('Game is not active');
  if (config.eliminations.some(e => e.playerId === playerId)) throw new Error('Already eliminated');
  if (!game.players.some(p => p.id === playerId)) throw new Error('Player not in game');

  const at = new Date().toISOString();
  const position = remainingPlayerIds(game).length; // players still in, incl. the one busting
  let eliminations = [...config.eliminations, { playerId, position, at }];

  const remaining = game.players.filter(p => !eliminations.some(e => e.playerId === p.id));
  if (remaining.length === 1) {
    eliminations = [...eliminations, { playerId: remaining[0].id, position: 1, at }];
    return {
      ...game,
      status: 'Finished',
      endedAt: at,
      tournament: { ...config, eliminations },
    };
  }

  return { ...game, tournament: { ...config, eliminations } };
}

/** Undo the most recent bust (only while the tournament is still Active). */
export function undoElimination(game: LocalGame): LocalGame {
  const config = game.tournament;
  if (!config) throw new Error('Not a tournament');
  if (game.status !== 'Active') throw new Error('Game is not active');
  if (config.eliminations.length === 0) return game;
  return { ...game, tournament: { ...config, eliminations: config.eliminations.slice(0, -1) } };
}

/**
 * Finish a tournament early: the host supplies a ranking of the players still in
 * (orderedRemainingIds[0] = best finish among them). Already-busted players keep
 * their positions; the remaining players fill positions 1..k above them. Pure.
 */
export function finishWithRanking(game: LocalGame, orderedRemainingIds: string[]): LocalGame {
  const config = game.tournament;
  if (!config) throw new Error('Not a tournament');
  if (game.status !== 'Active') throw new Error('Game is not active');

  const remaining = remainingPlayerIds(game);
  const remainingSet = new Set(remaining);
  if (orderedRemainingIds.length !== remaining.length || !orderedRemainingIds.every(id => remainingSet.has(id))) {
    throw new Error('Ranking must list every remaining player exactly once');
  }

  const at = new Date().toISOString();
  // Remaining players occupy the top positions 1..k; busted players already hold k+1..N.
  const newEliminations = orderedRemainingIds.map((playerId, i) => ({
    playerId,
    position: i + 1,
    at,
  }));

  return {
    ...game,
    status: 'Finished',
    endedAt: at,
    tournament: { ...config, eliminations: [...config.eliminations, ...newEliminations] },
  };
}
