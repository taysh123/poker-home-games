/**
 * Normalized end-of-game results for a FINISHED local game — the pure shape both the summary screen
 * and (later) the branded Results Card 2.0 read. This is a faithful extraction of the computation
 * that lived inline in LocalSessionSummaryScreen: cash games rank players by net and settle via the
 * two-pointer engine; tournaments produce a payout podium. Sibling to settlements.ts / tournament.ts.
 *
 * SCOPE (owner decision 2026-07-23): local source only, and DATA only — no rendering. The server
 * session's results pipeline (decimal, API-sourced) and any visual convergence of the two game-over
 * screens are folded into slice 2.2 (Results Card 2.0), which redesigns that surface deliberately.
 */
import { settleGame, type Transfer } from './settlements';
import { tournamentResult, contributionCents } from './tournament';
import type { LocalGame, LocalPlayer } from './types';

/** One cash player's finish: net P&L in cents (positive = up). Ranked by net, descending. */
export interface CashResultRow {
  player: LocalPlayer;
  netCents: number;
}

/** One tournament finish: 1-based position, prize payout, and net (payout − contribution). */
export interface PodiumRow {
  player: LocalPlayer;
  position: number;
  payoutCents: number;
  netCents: number;
}

export interface GameResults {
  /** Cash games only, sorted by net desc. Empty for tournaments. */
  results: CashResultRow[];
  /** Minimal who-pays-whom settlement (same for cash and tournament). */
  transfers: Transfer[];
  /** Cash: sum of buy-ins. Tournament: the prize pool. */
  totalPotCents: number;
  /** Tournaments only, sorted by finishing position asc. Null for cash. */
  podium: PodiumRow[] | null;
}

export function buildGameResults(game: LocalGame): GameResults {
  if (game.mode === 'tournament' && game.tournament) {
    const result = tournamentResult(game);
    const podium = result.standings.map(s => ({
      player: game.players.find(p => p.id === s.playerId)!,
      position: s.position,
      payoutCents: s.payoutCents,
      netCents: s.payoutCents - contributionCents(game, s.playerId),
    }));
    return {
      results: [],
      transfers: result.transfers,
      totalPotCents: result.poolCents,
      podium,
    };
  }

  const { balances, transfers } = settleGame(game);
  const results = game.players
    .map(player => ({
      player,
      netCents: balances.find(b => b.playerId === player.id)?.netCents ?? 0,
    }))
    .sort((a, b) => b.netCents - a.netCents);
  const totalPotCents = game.txns
    .filter(t => t.kind === 'buyin')
    .reduce((s, t) => s + t.amountCents, 0);
  return { results, transfers, totalPotCents, podium: null };
}
