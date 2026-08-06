import {
  dayBuckets, monthBuckets, netCentsForMonth, heatmapLevels, monthHeatLevels, heatReferenceCents,
  HEAT_BANDS,
} from '../calendar';
import { RAMP_STEPS } from '../heatCell';
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

describe('heatReferenceCents — the LOWER MEDIAN of |dayNet|, on the outcome scale', () => {
  it('is the middle |net| on an ODD number of active days', () => {
    const sessions = [
      day('2026-06-01T12:00:00', 1000),
      day('2026-06-02T12:00:00', -5000),
      day('2026-06-03T12:00:00', 9000),
    ];
    expect(heatReferenceCents(sessions)).toBe(5000);
  });

  it('takes the LOWER of the two middle values on an EVEN number of active days', () => {
    // A plain median would average these to 3000. The lower median never averages, so the
    // result is always a value the player actually produced.
    const sessions = [
      day('2026-06-01T12:00:00', 1000),
      day('2026-06-02T12:00:00', 2000),
      day('2026-06-03T12:00:00', 4000),
      day('2026-06-04T12:00:00', 9000),
    ];
    expect(heatReferenceCents(sessions)).toBe(2000);
  });

  it('THE n=2 PIN: one enormous night cannot enter the reference at an even count', () => {
    // The defect the previous version shipped. A plain median averages the two middle values,
    // which at n=2 means averaging BOTH values: (1000 + 500000) / 2 = 250500, a 250x drag.
    // The earlier pin claimed this property while testing only n=3 — odd, and therefore
    // structurally unable to observe it.
    const sessions = [
      day('2026-06-01T12:00:00', 1000),
      day('2026-06-02T12:00:00', 500_000),
    ];
    expect(heatReferenceCents(sessions)).toBe(1000);
  });

  it('resists an outlier at every count from 1 to 6, even and odd alike', () => {
    // Sweeping the count is the point: the defect was visible only at even n, so a fixture at
    // any single count can hide it.
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const ordinary = Array.from({ length: n }, (_, i) =>
        day(`2026-06-0${i + 1}T12:00:00`, 1000));
      const withOutlier = [...ordinary, day('2026-06-20T12:00:00', 9_000_000)];
      expect(heatReferenceCents(withOutlier)).toBe(1000);
    }
  });

  it('uses |net|, so a losing day contributes its magnitude like a winning one', () => {
    expect(heatReferenceCents([day('2026-06-01T12:00:00', -7000)])).toBe(7000);
  });

  it('ignores break-even days, and is 0 when there is nothing to measure', () => {
    expect(heatReferenceCents([])).toBe(0);
    expect(heatReferenceCents([day('2026-06-01T12:00:00', 0)])).toBe(0);
    expect(heatReferenceCents([
      day('2026-06-01T12:00:00', 0),
      day('2026-06-02T12:00:00', 3000),
    ])).toBe(3000);
  });

  it('sorts NUMERICALLY, not lexicographically', () => {
    // JS's default sort is string-based: [9000, 10000, 200000] would order as
    // 10000, 200000, 9000 and pick the wrong middle.
    const sessions = [
      day('2026-06-01T12:00:00', 9000),
      day('2026-06-02T12:00:00', 200_000),
      day('2026-06-03T12:00:00', 10_000),
    ];
    expect(heatReferenceCents(sessions)).toBe(10_000);
  });
});

describe('HEAT_BANDS', () => {
  it('is pinned to its literal edges', () => {
    expect(HEAT_BANDS).toEqual([0.6, 1.4, 2.5]);
  });

  it('has one fewer edge than the colour ramp has steps', () => {
    // Nothing in the types couples these. If a band is added without extending WIN_FILL /
    // LOSS_WIDTH, heatCellStyle indexes off the end and a loss renders as a no-session day.
    expect(HEAT_BANDS.length + 1).toBe(RAMP_STEPS);
  });

  it('places no edge on 1.0 — the modal ratio for a tournament player', () => {
    // On a bust, |net| equals that day's cost exactly, so ratio 1.0 is the most common value
    // in a tournament history. An edge there flips the modal day on a 1-cent difference.
    expect(HEAT_BANDS).not.toContain(1);
    const R = 10_000;
    expect(heatmapLevels([day('2026-06-01T12:00:00', -R)], R)[0].level).toBe(-2);
  });

  it('ascends, so the bands cannot overlap or invert', () => {
    for (let i = 1; i < HEAT_BANDS.length; i++) {
      expect(HEAT_BANDS[i]).toBeGreaterThan(HEAT_BANDS[i - 1]);
    }
  });
});

describe('heatmapLevels — banded against a STABLE reference (supersedes set-relative scaling)', () => {
  // REWRITTEN DELIBERATELY, twice, and neither time weakened.
  //   old  -> "a lone active day maxes out at the top level" and "scales relative to the largest
  //           |net| in the set". Those WERE the defect: a lone $20 night blazed, one outlier
  //           collapsed 20 nights to step 1, and a day changed level between month and year.
  //   then -> banded against median daily COST. That measured exposure while the calendar shows
  //           outcome, and the two scale asymmetrically (a loss is capped by the buy-in, a win
  //           is not), so the loss side could never reach the top step.
  //   now  -> banded against the lower median of |dayNet|, the same scale as the thing shown.
  // Every property worth keeping is still asserted below.
  const R = 10_000;

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
      day('2026-06-01T12:00:00', 3000),    // 0.30R -> 1
      day('2026-06-02T12:00:00', 9000),    // 0.90R -> 2
      day('2026-06-03T12:00:00', 20_000),  // 2.00R -> 3
      day('2026-06-04T12:00:00', 40_000),  // 4.00R -> 4
      day('2026-06-05T12:00:00', -9000),   // 0.90R losing -> -2
    ];
    const byDay = Object.fromEntries(heatmapLevels(sessions, R).map(l => [l.dayKey, l.level]));
    expect(byDay['2026-06-01']).toBe(1);
    expect(byDay['2026-06-02']).toBe(2);
    expect(byDay['2026-06-03']).toBe(3);
    expect(byDay['2026-06-04']).toBe(4);
    expect(byDay['2026-06-05']).toBe(-2);
  });

  it('the LOSS side can reach the top step — it is not capped by the buy-in', () => {
    // Under the cost anchor this was structurally impossible: the worst a cash player can lose
    // is one buy-in, which was exactly 1.0x the reference, so -4 was unreachable.
    expect(heatmapLevels([day('2026-06-01T12:00:00', -30_000)], R)[0].level).toBe(-4);
  });

  it('a lone session lands MID-ramp, neither blazing nor pretending to be small', () => {
    // Its own |net| is the reference, so the ratio is exactly 1.0 -> step 2. With one data
    // point that is the honest answer; the original bug painted step 4.
    const lone = [day('2026-06-01T12:00:00', 2000)];
    expect(heatmapLevels(lone, heatReferenceCents(lone))[0].level).toBe(2);
  });

  it('the smallest nonzero net still gets +/-1, never rounded down to 0', () => {
    expect(heatmapLevels([day('2026-06-01T12:00:00', 1)], R)[0].level).toBe(1);
    expect(heatmapLevels([day('2026-06-02T12:00:00', -1)], R)[0].level).toBe(-1);
  });

  it('clamps at the top of the ramp however large the day is', () => {
    expect(heatmapLevels([day('2026-06-01T12:00:00', 99_000_000)], R)[0].level).toBe(4);
  });

  it('never emits a step outside 1..4 for any ratio', () => {
    for (const net of [1, 5999, 6000, 6001, 13_999, 14_000, 24_999, 25_000, 25_001, 10 ** 9]) {
      for (const sign of [1, -1]) {
        const level = heatmapLevels([day('2026-06-01T12:00:00', net * sign)], R)[0].level;
        expect(Math.abs(level)).toBeGreaterThanOrEqual(1);
        expect(Math.abs(level)).toBeLessThanOrEqual(RAMP_STEPS);
        expect(Math.sign(level)).toBe(sign);
      }
    }
  });

  it('puts each exact band edge in the HIGHER step (the < side), consistently', () => {
    expect(heatmapLevels([day('2026-06-01T12:00:00', 6_000)], R)[0].level).toBe(2);   // 0.6R
    expect(heatmapLevels([day('2026-06-02T12:00:00', 14_000)], R)[0].level).toBe(3);  // 1.4R
    expect(heatmapLevels([day('2026-06-03T12:00:00', 25_000)], R)[0].level).toBe(4);  // 2.5R
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

describe('monthHeatLevels — visible DAYS, history-wide REFERENCE', () => {
  const JUNE = day('2026-06-10T12:00:00', 15_000);
  const MARCH = [day('2026-03-01T12:00:00', 3000), day('2026-03-02T12:00:00', 3000)];
  const ALL = [...MARCH, JUNE];

  it('returns only the requested month, ignoring every other month', () => {
    expect(monthHeatLevels(ALL, ALL, '2026-06').map(l => l.dayKey)).toEqual(['2026-06-10']);
  });

  it('derives the reference from ALL history, not from the visible month', () => {
    // All-history reference is 3000 (lower median of 3000/3000/15000), so June's day is 5.0R
    // -> step 4. Scoped to June the reference would be 15000 and the same day 1.0R -> step 2.
    expect(heatReferenceCents(ALL)).toBe(3000);
    expect(monthHeatLevels(ALL, ALL, '2026-06')[0].level).toBe(4);
  });

  it('gives a day the SAME level in the month view as in a whole-history (year) view', () => {
    // The property that blocked B6, stated precisely: one history must not yield two answers
    // depending on which view is asking. It is NOT "a level never changes" — a history-derived
    // reference should re-scale old days as the player moves up in stakes.
    const inMonth = monthHeatLevels(ALL, ALL, '2026-06').find(l => l.dayKey === '2026-06-10')!.level;
    const inYear = heatmapLevels(ALL, heatReferenceCents(ALL)).find(l => l.dayKey === '2026-06-10')!.level;
    expect(inMonth).toBe(inYear);
  });

  it('THE FILTER PIN: narrowing the visible set must not re-level the days that remain', () => {
    // The only caller passed its type/source-FILTERED list for BOTH halves, so switching the
    // Cash/Tournament tab silently re-derived the reference: the same day measured level 1 on
    // the All tab and level 2 on the Cash tab. Days come from `visible`, the ramp from `all`.
    const visibleOnlyJune = [JUNE];
    const unfiltered = monthHeatLevels(ALL, ALL, '2026-06')[0].level;
    const filteredDown = monthHeatLevels(ALL, visibleOnlyJune, '2026-06')[0].level;
    expect(filteredDown).toBe(unfiltered);
  });

  it('is empty for a month with no sessions', () => {
    expect(monthHeatLevels(ALL, ALL, '2026-07')).toEqual([]);
  });
});
