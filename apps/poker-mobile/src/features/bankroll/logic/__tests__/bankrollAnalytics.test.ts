import {
  sessionCostCents,
  sessionReturnCents,
  sessionNetCents,
  sessionDurationMinutes,
  isInTheMoney,
  filterSessions,
  summarize,
  bankrollOverTime,
  advancedStats,
  maxDrawdownCents,
  sessionNetHistogram,
  type BankrollPoint,
} from '../bankrollAnalytics';
import type { BankrollSession } from '../../types';

let idc = 0;
const base = (over: Partial<BankrollSession> = {}): BankrollSession => ({
  id: `s${++idc}`,
  gameType: 'cash',
  source: 'external',
  currency: 'ILS',
  startedAt: '2026-06-01T20:00:00.000Z',
  feesCents: 0,
  tags: [],
  createdAt: '2026-06-01T20:00:00.000Z',
  updatedAt: '2026-06-01T20:00:00.000Z',
  ...over,
});

const cash = (buyIn: number, cashOut: number, over: Partial<BankrollSession> = {}) =>
  base({ gameType: 'cash', cash: { buyInCents: buyIn, cashOutCents: cashOut }, ...over });

const mtt = (t: Partial<BankrollSession['tournament']> & object, over: Partial<BankrollSession> = {}) =>
  base({
    gameType: 'tournament',
    tournament: {
      buyInCents: 10000, feeCents: 1000, rebuyCount: 0, rebuyCents: 0,
      addOnCount: 0, addOnCents: 0, bountyCents: 0, payoutCents: 0, ...t,
    },
    ...over,
  });

describe('per-session money', () => {
  it('cash: net = cashOut − (buyIn + fees)', () => {
    const s = cash(5000, 9000, { feesCents: 500 });
    expect(sessionCostCents(s)).toBe(5500);
    expect(sessionReturnCents(s)).toBe(9000);
    expect(sessionNetCents(s)).toBe(3500);
  });

  it('tournament: cost sums entry+fee+rebuys+addons+fees; return = payout+bounty', () => {
    const s = mtt({
      buyInCents: 10000, feeCents: 1000, rebuyCount: 1, rebuyCents: 10000,
      addOnCount: 1, addOnCents: 5000, bountyCents: 2000, payoutCents: 40000,
    }, { feesCents: 0 });
    expect(sessionCostCents(s)).toBe(26000);     // 10000+1000+10000+5000
    expect(sessionReturnCents(s)).toBe(42000);   // 40000+2000
    expect(sessionNetCents(s)).toBe(16000);
  });

  it('losing tournament nets negative', () => {
    const s = mtt({ buyInCents: 10000, feeCents: 1000, payoutCents: 0 });
    expect(sessionNetCents(s)).toBe(-11000);
  });

  it('duration: explicit wins; else derived from start/end; else 0', () => {
    expect(sessionDurationMinutes(base({ durationMinutes: 90 }))).toBe(90);
    expect(sessionDurationMinutes(base({
      startedAt: '2026-06-01T20:00:00.000Z', endedAt: '2026-06-01T22:30:00.000Z',
    }))).toBe(150);
    expect(sessionDurationMinutes(base())).toBe(0);
  });

  it('ITM only for tournaments that returned money', () => {
    expect(isInTheMoney(mtt({ payoutCents: 5000 }))).toBe(true);
    expect(isInTheMoney(mtt({ payoutCents: 0, bountyCents: 1000 }))).toBe(true);
    expect(isInTheMoney(mtt({ payoutCents: 0 }))).toBe(false);
    expect(isInTheMoney(cash(5000, 9000))).toBe(false);
  });
});

describe('summarize', () => {
  it('handles an empty list with null advanced metrics', () => {
    const s = summarize([]);
    expect(s.sessionCount).toBe(0);
    expect(s.totalNetCents).toBe(0);
    expect(s.roiPct).toBeNull();
    expect(s.abiCents).toBeNull();
    expect(s.itmPct).toBeNull();
    expect(s.netPerHourCents).toBeNull();
    expect(s.winRatePct).toBe(0);
  });

  it('computes P&L split, ROI, ABI, ITM%, win rate, $/hr', () => {
    const sessions = [
      cash(5000, 9000, { durationMinutes: 120 }),                       // +4000, 2h
      mtt({ buyInCents: 10000, feeCents: 1000, payoutCents: 0 }),       // -11000, ITM no
      mtt({ buyInCents: 10000, feeCents: 1000, payoutCents: 33000 }),   // +22000, ITM yes
    ];
    const s = summarize(sessions);
    expect(s.sessionCount).toBe(3);
    expect(s.cashCount).toBe(1);
    expect(s.tournamentCount).toBe(2);
    expect(s.totalNetCents).toBe(15000);          // 4000 -11000 +22000
    expect(s.cashNetCents).toBe(4000);
    expect(s.tournamentNetCents).toBe(11000);     // -11000 +22000
    expect(s.tournamentInvestedCents).toBe(22000); // 11000 + 11000
    expect(s.abiCents).toBe(11000);                // 22000 / 2
    expect(s.roiPct).toBeCloseTo(50);              // 11000 / 22000 * 100
    expect(s.itmPct).toBeCloseTo(50);              // 1 of 2
    expect(s.winningSessions).toBe(2);
    expect(s.losingSessions).toBe(1);
    expect(s.winRatePct).toBeCloseTo((2 / 3) * 100);
    expect(s.netPerHourCents).toBe(7500);          // 15000 over 120min -> per hour
  });
});

describe('filterSessions', () => {
  const sessions = [
    cash(5000, 9000, { startedAt: '2026-01-10T20:00:00.000Z', tags: ['home'] }),
    mtt({ payoutCents: 0 }, { startedAt: '2026-03-15T20:00:00.000Z', source: 'in_app', tags: ['online'] }),
    cash(5000, 2000, { startedAt: '2026-06-20T20:00:00.000Z', tags: ['casino', 'home'] }),
  ];

  it('filters by date range (inclusive on startedAt)', () => {
    expect(filterSessions(sessions, { from: '2026-02-01T00:00:00.000Z', to: '2026-05-01T00:00:00.000Z' })).toHaveLength(1);
  });
  it('filters by game type and source', () => {
    expect(filterSessions(sessions, { gameType: 'cash' })).toHaveLength(2);
    expect(filterSessions(sessions, { source: 'in_app' })).toHaveLength(1);
  });
  it('filters by ANY matching tag', () => {
    expect(filterSessions(sessions, { tags: ['home'] })).toHaveLength(2);
    expect(filterSessions(sessions, { tags: ['casino'] })).toHaveLength(1);
    expect(filterSessions(sessions, { tags: ['nope'] })).toHaveLength(0);
  });

  it('filters by bankroll id (missing id resolves to default)', () => {
    const mixed = [
      cash(5000, 9000),                                   // no bankrollId -> default
      cash(5000, 2000, { bankrollId: 'online' }),
    ];
    expect(filterSessions(mixed, { bankrollId: 'default' })).toHaveLength(1);
    expect(filterSessions(mixed, { bankrollId: 'online' })).toHaveLength(1);
  });
});

describe('bankrollOverTime', () => {
  it('accumulates net chronologically from the starting bankroll', () => {
    const sessions = [
      cash(5000, 9000, { startedAt: '2026-06-03T20:00:00.000Z' }),   // +4000
      cash(5000, 2000, { startedAt: '2026-06-01T20:00:00.000Z' }),   // -3000 (earlier)
    ];
    const pts = bankrollOverTime(sessions, 100000);
    expect(pts.map(p => p.cumulativeCents)).toEqual([97000, 101000]); // sorted by date: -3000 then +4000
    expect(pts[0].at).toBe('2026-06-01T20:00:00.000Z');
  });
});

describe('advancedStats — variance / std-dev / best / worst', () => {
  it('returns nulls for an empty list (no sessions)', () => {
    const a = advancedStats([]);
    expect(a.count).toBe(0);
    expect(a.meanNetCents).toBeNull();
    expect(a.varianceCents2).toBeNull();
    expect(a.stdDevCents).toBeNull();
    expect(a.bestNetCents).toBeNull();
    expect(a.worstNetCents).toBeNull();
    expect(a.maxDrawdownCents).toBe(0);
  });

  it('needs >=2 sessions for variance/std-dev (sample, n-1) but reports best/worst/mean for one', () => {
    const a = advancedStats([cash(1000, 4000)]); // single net +3000
    expect(a.count).toBe(1);
    expect(a.meanNetCents).toBe(3000);
    expect(a.bestNetCents).toBe(3000);
    expect(a.worstNetCents).toBe(3000);
    expect(a.varianceCents2).toBeNull(); // n < 2 → undefined variance
    expect(a.stdDevCents).toBeNull();
    expect(a.maxDrawdownCents).toBe(0); // single point: no peak-to-trough
  });

  it('computes sample variance (n-1) and std-dev of session net', () => {
    // nets: -1000, 0, +1000 → mean 0, SS = 2,000,000, sample var = 2e6/2 = 1e6, std = 1000
    const a = advancedStats([cash(2000, 1000), cash(1000, 1000), cash(1000, 2000)]);
    expect(a.meanNetCents).toBe(0);
    expect(a.varianceCents2).toBe(1_000_000);
    expect(a.stdDevCents).toBe(1000);
    expect(a.bestNetCents).toBe(1000);
    expect(a.worstNetCents).toBe(-1000);
  });

  it('uses the sample estimator (n-1), not population (n)', () => {
    // nets: +4000, -11000, +22000 → mean 5000, SS = 546,000,000
    // sample var = 546e6 / 2 = 273,000,000 (population would be /3 = 182,000,000)
    const a = advancedStats([
      cash(1000, 5000),                                                // +4000
      mtt({ buyInCents: 10000, feeCents: 1000, payoutCents: 0 }),      // -11000
      mtt({ buyInCents: 10000, feeCents: 1000, payoutCents: 33000 }),  // +22000
    ]);
    expect(a.meanNetCents).toBe(5000);
    expect(a.varianceCents2).toBe(273_000_000);
    expect(a.stdDevCents).toBe(16523); // round(sqrt(273,000,000))
  });
});

describe('maxDrawdownCents — peak-to-trough on the cumulative series', () => {
  const pt = (cumulativeCents: number): BankrollPoint => ({ at: '', netCents: 0, cumulativeCents });

  it('is 0 for empty / single-point / monotonic series', () => {
    expect(maxDrawdownCents([])).toBe(0);
    expect(maxDrawdownCents([pt(-1000)])).toBe(0);
    expect(maxDrawdownCents([pt(0), pt(1000), pt(3000)])).toBe(0);
  });

  it('measures the largest peak-to-trough drop', () => {
    // peak 1000 (pt1) → trough -2500 (pt4) = 3500
    expect(maxDrawdownCents([pt(1000), pt(-2000), pt(-1500), pt(-2500), pt(1500)])).toBe(3500);
    expect(maxDrawdownCents([pt(-1000), pt(-3000)])).toBe(2000);
  });

  it('is shift-invariant: the starting bankroll does not change drawdown', () => {
    const sessions = [
      cash(0, 1000, { startedAt: '2026-06-01T20:00:00.000Z' }),                                          // +1000
      mtt({ buyInCents: 3000, feeCents: 0, payoutCents: 0 }, { startedAt: '2026-06-02T20:00:00.000Z' }), // -3000
      cash(0, 500, { startedAt: '2026-06-03T20:00:00.000Z' }),                                           // +500
      mtt({ buyInCents: 1000, feeCents: 0, payoutCents: 0 }, { startedAt: '2026-06-04T20:00:00.000Z' }), // -1000
      cash(0, 4000, { startedAt: '2026-06-05T20:00:00.000Z' }),                                          // +4000
    ];
    expect(maxDrawdownCents(bankrollOverTime(sessions, 0))).toBe(3500);
    expect(maxDrawdownCents(bankrollOverTime(sessions, 100000))).toBe(3500);
  });
});

describe('sessionNetHistogram — distribution buckets', () => {
  it('returns no bins for an empty list', () => {
    expect(sessionNetHistogram([])).toEqual([]);
  });

  it('collapses to a single bin when every session nets the same', () => {
    const bins = sessionNetHistogram([cash(1000, 1000), cash(2000, 2000)]); // nets 0, 0
    expect(bins).toEqual([{ fromCents: 0, toCents: 0, count: 2 }]);
  });

  it('buckets nets across the [min,max] range; counts always sum to n', () => {
    const sessions = [cash(2000, 1000), cash(1000, 1000), cash(1000, 2000)]; // -1000, 0, +1000
    const bins = sessionNetHistogram(sessions, 2);
    expect(bins).toHaveLength(2);
    expect(bins[0]).toEqual({ fromCents: -1000, toCents: 0, count: 1 });
    expect(bins[1]).toEqual({ fromCents: 0, toCents: 1000, count: 2 });
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(3);
  });
});
