import { dayBuckets, monthBuckets, netCentsForMonth, heatmapLevels } from '../calendar';
import type { BankrollSession } from '../../types';

let idc = 0;
// `localDateTime` has NO 'Z' suffix, so `new Date(...)` parses it as LOCAL time — the same
// construction buildSessionInput uses (local noon -> UTC ISO) — before converting to the UTC ISO
// string BankrollSession actually stores.
const day = (localDateTime: string, netCents: number, over: Partial<BankrollSession> = {}): BankrollSession => ({
  id: `s${++idc}`,
  gameType: 'cash',
  source: 'external',
  currency: 'ILS',
  startedAt: new Date(localDateTime).toISOString(),
  feesCents: 0,
  tags: [],
  cash: { buyInCents: 10000, cashOutCents: 10000 + netCents },
  createdAt: new Date(localDateTime).toISOString(),
  updatedAt: new Date(localDateTime).toISOString(),
  ...over,
});

describe('dayBuckets', () => {
  it('is empty for no sessions', () => {
    expect(dayBuckets([])).toEqual([]);
  });

  it('sums net and counts sessions on the same local day into one bucket', () => {
    const sessions = [
      day('2026-06-01T10:00:00', 4000),
      day('2026-06-01T20:00:00', -1500),
    ];
    const buckets = dayBuckets(sessions);
    expect(buckets).toEqual([{ dayKey: '2026-06-01', sessionCount: 2, netCents: 2500 }]);
  });

  it('separates different local days and sorts ascending by dayKey', () => {
    const sessions = [
      day('2026-06-03T12:00:00', 1000),
      day('2026-06-01T12:00:00', 2000),
      day('2026-06-02T12:00:00', -500),
    ];
    expect(dayBuckets(sessions).map(b => b.dayKey)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });
});

describe('monthBuckets', () => {
  it('sums net and counts sessions in the same local month into one bucket', () => {
    const sessions = [
      day('2026-06-01T12:00:00', 4000),
      day('2026-06-28T12:00:00', -1500),
    ];
    const buckets = monthBuckets(sessions);
    expect(buckets).toEqual([{ monthKey: '2026-06', sessionCount: 2, netCents: 2500 }]);
  });

  it('separates a session across a month boundary', () => {
    const sessions = [day('2026-05-31T23:30:00', 1000), day('2026-06-01T00:30:00', 2000)];
    const buckets = monthBuckets(sessions);
    expect(buckets.map(b => b.monthKey)).toEqual(['2026-05', '2026-06']);
  });
});

describe('netCentsForMonth', () => {
  it('returns the summed net for a month with sessions', () => {
    const sessions = [day('2026-06-01T12:00:00', 4000), day('2026-06-15T12:00:00', -1000)];
    expect(netCentsForMonth(sessions, '2026-06')).toBe(3000);
  });

  it('returns 0 for a month with no sessions (not an error/undefined)', () => {
    const sessions = [day('2026-06-01T12:00:00', 4000)];
    expect(netCentsForMonth(sessions, '2026-07')).toBe(0);
  });
});

describe('heatmapLevels', () => {
  it('is empty for no sessions', () => {
    expect(heatmapLevels([])).toEqual([]);
  });

  it('a lone active day maxes out at the top level', () => {
    const sessions = [day('2026-06-01T12:00:00', 5000)];
    const levels = heatmapLevels(sessions, 4);
    expect(levels).toEqual([{ dayKey: '2026-06-01', sessionCount: 1, netCents: 5000, level: 4 }]);
  });

  it('a break-even day (net exactly 0) is level 0, distinguishable from "no session" via sessionCount', () => {
    const sessions = [day('2026-06-01T12:00:00', 0)];
    const levels = heatmapLevels(sessions);
    expect(levels).toEqual([{ dayKey: '2026-06-01', sessionCount: 1, netCents: 0, level: 0 }]);
  });

  it('scales magnitude relative to the largest |net| in the set, sign matches net sign', () => {
    const sessions = [
      day('2026-06-01T12:00:00', 10000),  // biggest win -> +levelCount
      day('2026-06-02T12:00:00', 5000),   // half the biggest -> mid positive level
      day('2026-06-03T12:00:00', -10000), // biggest loss -> -levelCount
    ];
    const levels = heatmapLevels(sessions, 4);
    const byDay = Object.fromEntries(levels.map(l => [l.dayKey, l.level]));
    expect(byDay['2026-06-01']).toBe(4);
    expect(byDay['2026-06-02']).toBe(2);
    expect(byDay['2026-06-03']).toBe(-4);
  });

  it('the smallest nonzero net still gets level +/-1, never rounded down to 0', () => {
    const sessions = [
      day('2026-06-01T12:00:00', 10000), // sets maxAbsNet
      day('2026-06-02T12:00:00', 1),     // tiny win relative to the max
    ];
    const levels = heatmapLevels(sessions, 4);
    expect(levels.find(l => l.dayKey === '2026-06-02')!.level).toBe(1);
  });

  it('respects a custom levelCount', () => {
    const sessions = [day('2026-06-01T12:00:00', 5000)];
    expect(heatmapLevels(sessions, 10)[0].level).toBe(10);
  });
});
