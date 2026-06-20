import { positionsForSeats, ACTION_META, chipBreakdown, type PokerPosition } from '../pokerTable';

describe('positionsForSeats', () => {
  it('returns exactly `count` positions', () => {
    expect(positionsForSeats(6)).toHaveLength(6);
    expect(positionsForSeats(9)).toHaveLength(9);
  });
  it('6-max is the canonical UTG/HJ/CO/BTN/SB/BB set', () => {
    expect([...positionsForSeats(6)].sort()).toEqual(['BB', 'BTN', 'CO', 'HJ', 'SB', 'UTG']);
  });
  it('hero (index 0) is the Button', () => {
    expect(positionsForSeats(6)[0]).toBe('BTN');
  });
  it('always includes the blinds + button for full tables', () => {
    for (const n of [3, 4, 5, 6, 7, 8, 9]) {
      const set = new Set<PokerPosition>(positionsForSeats(n));
      expect(set.has('BTN')).toBe(true);
      expect(set.has('SB')).toBe(true);
      expect(set.has('BB')).toBe(true);
    }
  });
  it('heads-up folds SB into the Button', () => {
    expect(positionsForSeats(2)).toEqual(['BTN', 'BB']);
  });
  it('falls back to 6-max for unknown sizes', () => {
    expect(positionsForSeats(99)).toEqual(positionsForSeats(6));
  });
});

describe('ACTION_META', () => {
  it('covers every action with a label, tint, and icon', () => {
    (['raise', 'call', 'check', 'fold', 'allin'] as const).forEach(a => {
      expect(ACTION_META[a].label).toBeTruthy();
      expect(ACTION_META[a].tint).toBeTruthy();
      expect(ACTION_META[a].icon).toBeTruthy();
    });
    expect(ACTION_META.allin.label).toBe('All-In');
  });
});

describe('chipBreakdown', () => {
  it('is empty for zero / negative', () => {
    expect(chipBreakdown(0)).toEqual([]);
    expect(chipBreakdown(-500)).toEqual([]);
  });
  it('breaks a large amount into descending, capped chips', () => {
    const chips = chipBreakdown(100000_00); // big
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < chips.length; i++) {
      expect(chips[i].value).toBeLessThanOrEqual(chips[i - 1].value);
    }
  });
  it('renders at least one chip for a tiny positive amount', () => {
    expect(chipBreakdown(150).length).toBeGreaterThanOrEqual(1); // 1.50 major units
  });
});
