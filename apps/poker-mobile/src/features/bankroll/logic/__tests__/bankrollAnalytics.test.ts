import {
  sessionCostCents,
  sessionReturnCents,
  sessionNetCents,
  sessionDurationMinutes,
  isInTheMoney,
  filterSessions,
  summarize,
  bankrollOverTime,
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
