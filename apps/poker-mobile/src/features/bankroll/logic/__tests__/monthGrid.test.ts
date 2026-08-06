import {
  WEEKDAY_INITIALS, shiftMonth, monthLabel, monthGridCells, initialMonthKey,
} from '../monthGrid';

describe('initialMonthKey', () => {
  const AUGUST = new Date(2026, 7, 6); // local 2026-08-06

  it('stays on the current month when it has sessions', () => {
    // Never yank an active player backwards just because an older month has more data.
    expect(initialMonthKey(['2026-05', '2026-08'], AUGUST)).toBe('2026-08');
  });

  it('falls back to the most recent PAST month with sessions', () => {
    // Opening on a blank grid while history sits one tap back is the defect being fixed.
    expect(initialMonthKey(['2026-03', '2026-07', '2026-05'], AUGUST)).toBe('2026-07');
  });

  it('falls back to the earliest FUTURE month when all sessions are ahead of today', () => {
    // The log form accepts any date, so a session can be forward-dated.
    expect(initialMonthKey(['2026-11', '2026-09'], AUGUST)).toBe('2026-09');
  });

  it('prefers a past month over a future one when both exist', () => {
    expect(initialMonthKey(['2026-06', '2026-12'], AUGUST)).toBe('2026-06');
  });

  it('returns the current month when there are no sessions at all', () => {
    expect(initialMonthKey([], AUGUST)).toBe('2026-08');
  });

  it('crosses a year boundary when the most recent data is last year', () => {
    expect(initialMonthKey(['2025-12', '2025-06'], new Date(2026, 0, 15))).toBe('2025-12');
  });
});

describe('WEEKDAY_INITIALS', () => {
  it('is seven Sunday-first column headers', () => {
    expect(WEEKDAY_INITIALS).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('AGREES with the column each date actually lands in — the header and the grid offset are separate constants', () => {
    // The literal test above only restates the source line; it has zero power to detect the
    // headers and the grid DISAGREEING. The realistic bad edit is "make the calendar
    // Monday-first like the rest of the world": someone rotates WEEKDAY_INITIALS and its
    // literal test, never noticing that monthGridCells derives its offset from getDay() (which
    // is Sunday-based). Every date then sits one column off its header letter, silently.
    //
    // This pin derives the expected letter from the real Date rather than from the constant,
    // so a one-sided change to either side goes red.
    const INITIAL_OF_DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // getDay() 0..6 -> Sunday..Saturday
    for (const monthKey of ['2026-01', '2026-02', '2026-06', '2026-08', '2028-02']) {
      const cells = monthGridCells(monthKey);
      cells.forEach((dayKey, index) => {
        if (!dayKey) return;
        const [y, m, d] = dayKey.split('-').map(Number);
        const column = index % 7;
        expect(WEEKDAY_INITIALS[column]).toBe(INITIAL_OF_DAY[new Date(y, m - 1, d).getDay()]);
      });
    }
  });
});

describe('shiftMonth', () => {
  it('moves forward and backward within a year', () => {
    expect(shiftMonth('2026-06', 1)).toBe('2026-07');
    expect(shiftMonth('2026-06', -1)).toBe('2026-05');
    expect(shiftMonth('2026-06', 0)).toBe('2026-06');
  });

  it('rolls the year over in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('handles multi-month jumps across a year boundary', () => {
    expect(shiftMonth('2026-11', 3)).toBe('2027-02');
    expect(shiftMonth('2026-02', -14)).toBe('2024-12');
  });
});

describe('monthLabel', () => {
  it('renders a full English month name and year', () => {
    expect(monthLabel('2026-06')).toBe('June 2026');
    expect(monthLabel('2026-01')).toBe('January 2026');
    expect(monthLabel('2026-12')).toBe('December 2026');
  });
});

describe('monthGridCells', () => {
  it('pads to whole weeks and puts day 01 at its real weekday column', () => {
    // June 2026 starts on a Monday (column index 1) and has 30 days.
    const cells = monthGridCells('2026-06');
    expect(cells).toHaveLength(35);          // 1 lead + 30 days = 31 -> 5 whole weeks
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe('2026-06-01');
    expect(cells[30]).toBe('2026-06-30');
    expect(cells.slice(31)).toEqual([null, null, null, null]);
  });

  it('needs no padding when a month starts Sunday and fits exactly', () => {
    // February 2026 starts on a Sunday and has 28 days -> exactly 4 weeks, no nulls at all.
    const cells = monthGridCells('2026-02');
    expect(cells).toHaveLength(28);
    expect(cells.filter(c => c === null)).toEqual([]);
    expect(cells[0]).toBe('2026-02-01');
    expect(cells[27]).toBe('2026-02-28');
  });

  it('spills into a sixth week when it has to', () => {
    // August 2026 starts on a Saturday (column 6) and has 31 days -> 37 -> 6 weeks.
    const cells = monthGridCells('2026-08');
    expect(cells).toHaveLength(42);
    expect(cells[6]).toBe('2026-08-01');
    expect(cells[36]).toBe('2026-08-31');
  });

  it('counts leap-year February correctly', () => {
    const cells2028 = monthGridCells('2028-02').filter(Boolean);
    expect(cells2028).toHaveLength(29);
    expect(cells2028[28]).toBe('2028-02-29');
    expect(monthGridCells('2026-02').filter(Boolean)).toHaveLength(28);
  });

  it('emits contiguous, ordered day keys with no gaps', () => {
    const days = monthGridCells('2026-06').filter((c): c is string => c !== null);
    expect(days).toHaveLength(30);
    days.forEach((key, i) => expect(key).toBe(`2026-06-${String(i + 1).padStart(2, '0')}`));
  });

  it('always returns a whole number of 7-column weeks', () => {
    for (const key of ['2026-01', '2026-02', '2026-08', '2028-02', '2027-11']) {
      expect(monthGridCells(key).length % 7).toBe(0);
    }
  });
});
