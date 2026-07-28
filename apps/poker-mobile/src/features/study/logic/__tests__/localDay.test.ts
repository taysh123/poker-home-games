import { localDayKey, localMonthKey } from '../localDay';

describe('localDayKey', () => {
  it('formats from LOCAL date components with zero-padding', () => {
    expect(localDayKey(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05'); // just past local midnight
    expect(localDayKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31'); // just before local midnight
  });

  it('pads single-digit months and days', () => {
    expect(localDayKey(new Date(2026, 8, 9, 12, 0))).toBe('2026-09-09');
  });

  it('defaults to now and returns a well-formed key', () => {
    expect(localDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('localMonthKey (Q0: month buckets are LOCAL — toISOString().slice(0,7) is UTC)', () => {
  it('formats from LOCAL components with zero-padding', () => {
    expect(localMonthKey(new Date(2026, 0, 5))).toBe('2026-01');
    expect(localMonthKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12');
    // 1st of a month just past local midnight — the UTC key would say the PREVIOUS month
    // in any positive-offset timezone; the local key must not.
    expect(localMonthKey(new Date(2026, 7, 1, 0, 30))).toBe('2026-08');
  });

  it('defaults to now and returns a well-formed key', () => {
    expect(localMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });
});
