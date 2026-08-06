/**
 * Session-history paging (B5) — pure. INCREMENTAL REVEAL, not virtualization: BankrollScreen is
 * one ScrollView with several sections, so this caps how many rows mount at once rather than
 * recycling them. Never describe it as virtualized. The calendar is an explicit invitation to
 * year-scale data, so the cap lands here (B5) rather than after the year view invites it (B6).
 *
 * The real fix, if the cap is ever insufficient, is converting the history to a FlatList
 * (memoized renderItem, stable keyExtractor) — a restructure of the screen, recorded as its own
 * follow-up slice in the Q2 master plan rather than smuggled in here.
 */
export const SESSION_PAGE_SIZE = 20;

export interface HistoryPage<T> {
  visible: T[];
  remaining: number;
  hasMore: boolean;
}

export function historyPage<T>(items: T[], visibleCount: number): HistoryPage<T> {
  const count = Number.isFinite(visibleCount)
    ? Math.max(0, Math.min(visibleCount, items.length))
    : 0;
  return {
    visible: items.slice(0, count),
    remaining: items.length - count,
    hasMore: count < items.length,
  };
}
