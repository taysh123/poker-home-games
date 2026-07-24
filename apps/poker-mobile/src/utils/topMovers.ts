import type { PlayerLeaderboardEntryDto } from '../api/groupsApi';

/**
 * The week's top movers for a crew (slice 2.5): members who are UP this week, ranked by net P&L
 * descending, capped. Losers and flat players are excluded — this is a "who's winning this week"
 * strip, not the full standings. Pure; the server already sorts, but we sort defensively.
 */
export function topWeeklyMovers(
  entries: PlayerLeaderboardEntryDto[],
  limit = 3,
): PlayerLeaderboardEntryDto[] {
  return entries
    .filter(e => e.totalProfitLoss > 0) // filter already returns a fresh array, so the sort below
    .sort((a, b) => b.totalProfitLoss - a.totalProfitLoss) // never touches the caller's array
    .slice(0, Math.max(0, limit));
}
