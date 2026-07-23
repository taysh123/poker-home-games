/**
 * Stats derived from finished local games. Per-player attribution is
 * impossible locally (no accounts), so local stats describe the SESSION:
 * games played, total buy-ins across them, and the biggest single win.
 * Used by the guest Stats tab.
 */

import { computeBalances } from './settlements';
import type { LocalGame } from './types';

export interface LocalGameResult {
  gameId: string;
  name: string;
  endedAt: string;
  playerCount: number;
  totalPotCents: number;
  winnerName: string | null;
  winnerNetCents: number;
}

export interface LocalStats {
  gamesPlayed: number;
  totalMoneyMovedCents: number;
  biggestWinCents: number;
  biggestWinPlayerName: string | null;
  recentResults: LocalGameResult[];
}

export function gameResult(game: LocalGame): LocalGameResult {
  const balances = computeBalances(game);
  const totalPotCents = game.txns
    .filter(t => t.kind === 'buyin')
    .reduce((sum, t) => sum + t.amountCents, 0);

  let winnerNetCents = 0;
  let winnerName: string | null = null;
  for (const balance of balances) {
    if (balance.netCents > winnerNetCents) {
      winnerNetCents = balance.netCents;
      winnerName = game.players.find(p => p.id === balance.playerId)?.name ?? null;
    }
  }

  return {
    gameId: game.id,
    name: game.name,
    endedAt: game.endedAt ?? game.createdAt,
    playerCount: game.players.length,
    totalPotCents,
    winnerName,
    winnerNetCents,
  };
}

export function computeLocalStats(games: LocalGame[]): LocalStats {
  const finished = games
    .filter(g => g.status === 'Finished' && !g.deletedAt) // tombstoned games are excluded from stats
    .sort((a, b) => (b.endedAt ?? b.createdAt).localeCompare(a.endedAt ?? a.createdAt));

  const results = finished.map(gameResult);

  let biggestWinCents = 0;
  let biggestWinPlayerName: string | null = null;
  for (const result of results) {
    if (result.winnerNetCents > biggestWinCents) {
      biggestWinCents = result.winnerNetCents;
      biggestWinPlayerName = result.winnerName;
    }
  }

  return {
    gamesPlayed: finished.length,
    totalMoneyMovedCents: results.reduce((sum, r) => sum + r.totalPotCents, 0),
    biggestWinCents,
    biggestWinPlayerName,
    recentResults: results.slice(0, 10),
  };
}
