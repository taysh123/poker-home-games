import {
  dayBuckets, monthBuckets, netCentsForMonth, heatmapLevels, monthHeatLevels, heatReferenceCents,
} from '../calendar';
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

describe('heatReferenceCents — a property of the player, not of the view', () => {
  it('is the median DAILY cost, so a two-session day counts both buy-ins', () => {
    // The `day` helper always buys in for 10000. One day with two sessions therefore costs
    // 20000, and the median across [10000, 20000] is 15000.
    const sessions = [
      day('2026-06-01T12:00:00', 500),
      day('2026-06-02T12:00:00', 500),
      day('2026-06-02T20:00:00', 500),
    ];
    expect(heatReferenceCents(sessions)).toBe(15000);
  });

  it('is defined from the very FIRST session, and does not depend on how that session went', () => {
    // This is why cost beats a percentile of outcomes: a percentile over one day IS that day,
    // so it saturates. A buy-in is known before the result is.
    expect(heatReferenceCents([day('2026-06-01T12:00:00', 20)])).toBe(10000);
    expect(heatReferenceCents([day('2026-06-01T12:00:00', -99999)])).toBe(10000);
  });

  it('uses the median so one huge rebuy night cannot drag the reference', () => {
    const sessions = [
      day('2026-06-01T12:00:00', 0),
      day('2026-06-02T12:00:00', 0),
      day('2026-06-03T12:00:00', 0, { cash: { buyInCents: 5_000_000, cashOutCents: 5_000_000 } }),
    ];
    expect(heatReferenceCents(sessions)).toBe(10000);
  });

  it('is 0 when there is nothing to measure', () => {
    expect(heatReferenceCents([])).toBe(0);
  });
});

describe('heatmapLevels — banded against a STABLE reference (supersedes set-relative scaling)', () => {
  // REWRITTEN DELIBERATELY, not weakened. The previous pins asserted the OLD behaviour — "a
  // lone active day maxes out at the top level" and "scales magnitude relative to the largest
  // |net| in the set" — which was the defect, not the contract: it made a lone $20 night blaze
  // at step 4, collapsed 20 normal nights to step 1 beside one outlier, and rendered the same
  // day at different intensities in the month and year views. The properties below are strictly
  // stronger, and everything worth keeping (sign matching, break-even staying 0, the smallest
  // win never rounding to 0) is still asserted here.
  //
  // The old `levelCount` guard tests are gone because the PARAMETER is gone, not because the
  // guard was relaxed: banding removes that whole bug class, since a step can only ever be one
  // of four values by construction.
  const R = 10000; // matches the helper's buy-in, so bands fall at 5000 / 10000 / 20000

  it('is empty for no sessions', () => {
    expect(heatmapLevels([], R)).toEqual([]);
  });

  it('a break-even day is level 0, distinguishable from "no session" via sessionCount', () => {
    expect(heatmapLevels([day('2026-06-01T12:00:00', 0)], R)).toEqual([
      { dayKey: '2026-06-01', sessionCount: 1, netCents: 0, level: 0 },
    ]);
  });

  it('bands each day against the reference, with the sign matching the net', () => {
    const sessions = [
      day('2026-06-01T12:00:00', 2000),    // 0.2R -> step 1
      day('2026-06-02T12:00:00', 7000),    // 0.7R -> step 2
      day('2026-06-03T12:00:00', 15000),   // 1.5R -> step 3
      day('2026-06-04T12:00:00', 40000),   // 4.0R -> step 4
      day('2026-06-05T12:00:00', -7000),   // 0.7R losing -> step -2
    ];
    const byDay = Object.fromEntries(heatmapLevels(sessions, R).map(l => [l.dayKey, l.level]));
    expect(byDay['2026-06-01']).toBe(1);
    expect(byDay['2026-06-02']).toBe(2);
    expect(byDay['2026-06-03']).toBe(3);
    expect(byDay['2026-06-04']).toBe(4);
    expect(byDay['2026-06-05']).toBe(-2);
  });

  it('a lone small night no longer blazes — it is small against the reference', () => {
    // The headline saturation bug: this day was trivially its own maximum, so it painted step 4.
    expect(heatmapLevels([day('2026-06-01T12:00:00', 2000)], R)[0].level).toBe(1);
  });

  it('near-identical small nights all read small, instead of all reading maximal', () => {
    const sessions = [
      day('2026-06-01T12:00:00', 2000),
      day('2026-06-02T12:00:00', 1900),
      day('2026-06-03T12:00:00', 1800),
    ];
    expect(heatmapLevels(sessions, R).map(l => l.level)).toEqual([1, 1, 1]);
  });

  it('one outlier no longer compresses every normal night to step 1', () => {
    const sessions = [
      day('2026-06-01T12:00:00', 500_000), // the outlier
      ...Array.from({ length: 6 }, (_, i) => day(`2026-06-${10 + i}T12:00:00`, 8000 + i * 300)),
    ];
    const normal = heatmapLevels(sessions, R).filter(l => l.dayKey !== '2026-06-01');
    expect(normal).toHaveLength(6);
    expect(normal.every(l => Math.abs(l.level) > 1)).toBe(true);
  });

  it('the smallest nonzero net still gets +/-1, never rounded down to 0', () => {
    expect(heatmapLevels([day('2026-06-01T12:00:00', 1)], R)[0].level).toBe(1);
    expect(heatmapLevels([day('2026-06-02T12:00:00', -1)], R)[0].level).toBe(-1);
  });

  it('clamps at the top of the ramp however large the day is', () => {
    expect(heatmapLevels([day('2026-06-01T12:00:00', 99_000_000)], R)[0].level).toBe(4);
  });

  describe('the fallback when no usable reference exists', () => {
    // Stated behaviour, not an accident: a played day must not blaze, must not throw, and must
    // not read as break-even (0 already means that). It keeps its sign at the lowest step.
    for (const bad of [0, -1, NaN]) {
      it(`renders every played day at step 1 with its sign when the reference is ${bad}`, () => {
        const sessions = [day('2026-06-01T12:00:00', 500_000), day('2026-06-02T12:00:00', -20)];
        expect(heatmapLevels(sessions, bad).map(l => l.level)).toEqual([1, -1]);
      });
    }

    it('still reports a break-even day as 0, not as step 1', () => {
      expect(heatmapLevels([day('2026-06-01T12:00:00', 0)], 0)[0].level).toBe(0);
    });
  });
});

describe('monthHeatLevels — month-scoped DAYS, history-wide REFERENCE', () => {
  it('returns only the requested month, ignoring every other month', () => {
    const sessions = [day('2026-06-10T12:00:00', 1000), day('2026-07-10T12:00:00', 2000)];
    expect(monthHeatLevels(sessions, '2026-06').map(l => l.dayKey)).toEqual(['2026-06-10']);
  });

  // These fixtures deliberately vary the BUY-IN across months, not just the net. The reference
  // reads COST, so a fixture where every month shares one buy-in cannot detect the reference
  // being scoped wrongly — an earlier version of these tests had exactly that hole and a
  // mutation scoping the reference to the visible month passed all 27 of them.
  const highStake = (dayKey: string) =>
    day(`${dayKey}T12:00:00`, 0, { cash: { buyInCents: 100_000, cashOutCents: 100_000 } });
  // Three ₪1,000 days in March against one ₪100 day in June: the all-history median daily cost
  // is 100_000, while June alone would be 10_000 — a tenfold difference in the reference.
  const MIXED_STAKES = [
    highStake('2026-03-01'), highStake('2026-03-02'), highStake('2026-03-03'),
    day('2026-06-10T12:00:00', 15000),
  ];

  it('derives the reference from ALL history, not from the visible month', () => {
    expect(heatReferenceCents(MIXED_STAKES)).toBe(100_000);
    // 15000 against a 100_000 reference is 0.15x -> step 1. Scoped to June the reference would
    // be 10_000, making the same day 1.5x -> step 3.
    expect(monthHeatLevels(MIXED_STAKES, '2026-06')[0].level).toBe(1);
  });

  it('gives a day the SAME level in the month view as in a whole-history (year) view', () => {
    // THE property that blocked B6, stated correctly. It is not "a day's level never changes"
    // — a history-derived reference legitimately re-scales old days when you move up in stakes,
    // and that is desirable. It is that ONE history must not yield two different answers
    // depending on which view is asking.
    const inMonth = monthHeatLevels(MIXED_STAKES, '2026-06')
      .find(l => l.dayKey === '2026-06-10')!.level;
    const inYear = heatmapLevels(MIXED_STAKES, heatReferenceCents(MIXED_STAKES))
      .find(l => l.dayKey === '2026-06-10')!.level;
    expect(inMonth).toBe(inYear);
  });

  it('is empty for a month with no sessions', () => {
    expect(monthHeatLevels([day('2026-06-10T12:00:00', 1000)], '2026-07')).toEqual([]);
  });
});
