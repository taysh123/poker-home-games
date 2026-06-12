/**
 * Local tournament logic. Pure functions; amounts in integer cents.
 *
 * Payouts reuse the proven settlement engine: each player's net =
 * payout(position) − contributed(entry + rebuys), then the greedy
 * calculateSettlements turns nets into minimal "X pays Y" transfers —
 * identical rendering to cash-game settlements.
 */

import { calculateSettlements, type PlayerBalance, type Transfer } from './settlements';
import type { LocalGame, PayoutPreset } from './types';

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

/** Entry fees + rebuys — every buy-in transaction feeds the pool. */
export function prizePoolCents(game: Pick<LocalGame, 'txns'>): number {
  return game.txns.filter(t => t.kind === 'buyin').reduce((s, t) => s + t.amountCents, 0);
}

export function remainingPlayerIds(game: LocalGame): string[] {
  const busted = new Set((game.tournament?.eliminations ?? []).map(e => e.playerId));
  return game.players.filter(p => !busted.has(p.id)).map(p => p.id);
}

/**
 * Split the pool by preset percentages using largest-remainder allocation —
 * payouts always sum to the pool exactly, in cents.
 */
export function payoutAmountsCents(poolCents: number, preset: PayoutPreset): number[] {
  const percents = PAYOUT_PRESETS[preset];
  const raw = percents.map(p => (poolCents * p) / 100);
  const floors = raw.map(Math.floor);
  let remainder = poolCents - floors.reduce((s, n) => s + n, 0);
  // Hand out leftover cents to the largest fractional parts (stable order on tie).
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  const result = [...floors];
  for (let i = 0; i < remainder; i++) result[order[i % order.length].index] += 1;
  return result;
}

/** Cents each player put in (entry + rebuys). */
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
  const payouts = payoutAmountsCents(poolCents, config.payoutPreset);

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
 * Bust a player out. Positions assign bottom-up (first bust = last place).
 * When one player remains they take position 1 and the game finishes.
 * Returns a NEW game object (pure).
 */
export function eliminatePlayer(game: LocalGame, playerId: string): LocalGame {
  const config = game.tournament;
  if (!config) throw new Error('Not a tournament');
  if (game.status !== 'Active') throw new Error('Game is not active');
  if (config.eliminations.some(e => e.playerId === playerId)) throw new Error('Already eliminated');
  if (!game.players.some(p => p.id === playerId)) throw new Error('Player not in game');

  const at = new Date().toISOString();
  const position = game.players.length - config.eliminations.length;
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
