import { positionsForSeats, buildTrainerSeats, ACTION_META, chipBreakdown, type PokerPosition } from '../pokerTable';

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

describe('buildTrainerSeats', () => {
  it('returns one seat per table size with hero at index 0', () => {
    const seats = buildTrainerSeats(9, 'RFI', 'CO');
    expect(seats).toHaveLength(9);
    expect(seats[0]).toEqual({ position: 'CO', state: 'hero' });
    expect(seats.filter(s => s.state === 'hero')).toHaveLength(1);
  });

  it('always seats hero even if the position is not in the canonical ring', () => {
    // 2-max ring is [BTN, BB] — asking for SB should still produce a hero seat.
    const seats = buildTrainerSeats(2, 'vs_RFI', 'SB', 'BTN');
    expect(seats[0]).toEqual({ position: 'SB', state: 'hero' });
    expect(seats.some(s => s.state === 'hero')).toBe(true);
  });

  it('vs_RFI: only the villain is active, everyone else folded', () => {
    const seats = buildTrainerSeats(6, 'vs_RFI', 'BB', 'CO');
    expect(seats.find(s => s.position === 'CO')?.state).toBe('active');
    expect(seats.filter(s => s.state === 'active')).toHaveLength(1);
    const folded = seats.filter(s => s.state === 'folded').map(s => s.position).sort();
    expect(folded).toEqual(['BTN', 'HJ', 'SB', 'UTG']);
  });

  it('RFI: seats yet to act after hero are active, earlier seats folded', () => {
    // Hero opens from CO 6-max → BTN/SB/BB still to act; UTG/HJ already folded.
    const seats = buildTrainerSeats(6, 'RFI', 'CO');
    const active = seats.filter(s => s.state === 'active').map(s => s.position).sort();
    const folded = seats.filter(s => s.state === 'folded').map(s => s.position).sort();
    expect(active).toEqual(['BB', 'BTN', 'SB']);
    expect(folded).toEqual(['HJ', 'UTG']);
  });

  it('keeps every position unique and clockwise from hero', () => {
    const seats = buildTrainerSeats(9, 'vs_RFI', 'UTG', 'BTN');
    expect(new Set(seats.map(s => s.position)).size).toBe(9);
    expect(seats[0].position).toBe('UTG');
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
