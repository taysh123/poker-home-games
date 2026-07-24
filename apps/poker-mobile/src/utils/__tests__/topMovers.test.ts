import { topWeeklyMovers, moverLabel } from '../topMovers';
import type { PlayerLeaderboardEntryDto } from '../../api/groupsApi';

// Minimal fixture — only the fields topWeeklyMovers reads matter.
const entry = (username: string, totalProfitLoss: number): PlayerLeaderboardEntryDto =>
  ({ userId: username, username, sessionsPlayed: 1, totalProfitLoss, biggestWin: null, biggestLoss: null, winsCount: 0, avgProfitLoss: 0 } as PlayerLeaderboardEntryDto);

describe('topWeeklyMovers — the week\'s winners, ranked, capped', () => {
  it('keeps only members who are UP, sorted by P&L descending, capped at 3', () => {
    const input = [
      entry('Sam', 180),
      entry('Alex', -310),
      entry('Dana', 420),
      entry('Flat', 0),
      entry('Jo', 90),
      entry('Kim', 50),
    ];
    const movers = topWeeklyMovers(input);
    expect(movers.map(m => [m.username, m.totalProfitLoss])).toEqual([
      ['Dana', 420],
      ['Sam', 180],
      ['Jo', 90],
    ]);
  });

  it('excludes losers and flat (zero) players entirely', () => {
    const movers = topWeeklyMovers([entry('Alex', -310), entry('Flat', 0)]);
    expect(movers).toEqual([]);
  });

  it('returns fewer than the cap when fewer are up', () => {
    const movers = topWeeklyMovers([entry('Dana', 420), entry('Alex', -50)]);
    expect(movers.map(m => m.username)).toEqual(['Dana']);
  });

  it('respects a custom limit and an empty input', () => {
    expect(topWeeklyMovers([], 3)).toEqual([]);
    const two = topWeeklyMovers([entry('A', 3), entry('B', 2), entry('C', 1)], 2);
    expect(two.map(m => m.username)).toEqual(['A', 'B']);
  });

  it('handles a zero/negative limit and excludes NaN P&L', () => {
    const up = [entry('A', 3), entry('B', 2)];
    expect(topWeeklyMovers(up, 0)).toEqual([]);
    expect(topWeeklyMovers(up, -1)).toEqual([]);
    // NaN > 0 is false, so a NaN P&L is filtered out like any non-winner.
    expect(topWeeklyMovers([entry('Dana', 100), entry('Bad', NaN)]).map(m => m.username)).toEqual(['Dana']);
  });

  it('does not mutate the input array', () => {
    const input = [entry('Sam', 180), entry('Dana', 420)];
    const snapshot = input.map(e => e.username);
    topWeeklyMovers(input);
    expect(input.map(e => e.username)).toEqual(snapshot);
  });
});

describe('moverLabel — "You" for the signed-in user', () => {
  const dana = { ...entry('Dana', 420), userId: 'u-dana' };

  it('returns "You" when the entry is the current user', () => {
    expect(moverLabel(dana, 'u-dana')).toBe('You');
  });

  it('returns the username for anyone else', () => {
    expect(moverLabel(dana, 'u-someone-else')).toBe('Dana');
  });

  it('returns the username when there is no current user id (guest / unknown)', () => {
    expect(moverLabel(dana, undefined)).toBe('Dana');
  });
});
