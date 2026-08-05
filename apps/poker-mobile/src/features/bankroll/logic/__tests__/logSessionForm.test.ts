import {
  parseMoneyCents,
  parseCount,
  shouldShowNativeDatePicker,
  formatTagsLine,
  buildSessionInput,
  type LogSessionFormFields,
} from '../logSessionForm';

describe('parseMoneyCents', () => {
  it('parses whole numbers, decimals, and strips commas', () => {
    expect(parseMoneyCents('50')).toBe(5000);
    expect(parseMoneyCents('50.5')).toBe(5050);
    expect(parseMoneyCents('50.55')).toBe(5055);
    expect(parseMoneyCents('1,000')).toBe(100000);
  });

  it('empty input is 0 (allows a busted/zero payout)', () => {
    expect(parseMoneyCents('')).toBe(0);
    expect(parseMoneyCents('   ')).toBe(0);
  });

  it('rejects non-numeric or malformed input', () => {
    expect(parseMoneyCents('abc')).toBeNull();
    expect(parseMoneyCents('-5')).toBeNull();
    expect(parseMoneyCents('5.555')).toBeNull();
  });
});

describe('parseCount', () => {
  it('parses non-negative integers', () => {
    expect(parseCount('3')).toBe(3);
    expect(parseCount('0')).toBe(0);
  });

  it('empty, negative, or non-numeric input is 0', () => {
    expect(parseCount('')).toBe(0);
    expect(parseCount('-1')).toBe(0);
    expect(parseCount('abc')).toBe(0);
  });
});

describe('shouldShowNativeDatePicker — decoupled from the polish flag (B2)', () => {
  it('is true on every native platform', () => {
    expect(shouldShowNativeDatePicker('ios')).toBe(true);
    expect(shouldShowNativeDatePicker('android')).toBe(true);
    expect(shouldShowNativeDatePicker('windows')).toBe(true);
  });

  it('is false on web — DateTimePicker has no web build, a real necessary fallback', () => {
    expect(shouldShowNativeDatePicker('web')).toBe(false);
  });
});

describe('formatTagsLine', () => {
  it('joins multiple tags with a comma', () => {
    expect(formatTagsLine(['home', 'deep'])).toBe('home, deep');
  });

  it('returns a single tag as-is', () => {
    expect(formatTagsLine(['home'])).toBe('home');
  });

  it('returns null when there are no tags to show', () => {
    expect(formatTagsLine([])).toBeNull();
  });
});

describe('buildSessionInput', () => {
  const baseFields: LogSessionFormFields = {
    gameType: 'cash',
    source: 'external',
    date: '2026-06-01',
    venue: '',
    durationMin: '',
    notes: '',
    tags: '',
    fees: '',
    cashBuyIn: '50',
    cashOut: '90',
    tBuyIn: '',
    tFee: '',
    tRebuy: '',
    tRebuyCount: '',
    tAddOn: '',
    tAddOnCount: '',
    tPayout: '',
    tBounty: '',
    tEntrants: '',
    tFinish: '',
  };

  it('rejects an invalid date', () => {
    const result = buildSessionInput({ ...baseFields, date: '06/01/2026' });
    expect(result.error).toBe('Enter a valid date (YYYY-MM-DD).');
  });

  it('rejects non-numeric fees', () => {
    const result = buildSessionInput({ ...baseFields, fees: 'free' });
    expect(result.error).toBe('Fees must be a number.');
  });

  describe('cash', () => {
    it('builds a valid cash session', () => {
      const result = buildSessionInput(baseFields);
      expect(result.error).toBeUndefined();
      expect(result.input?.cash).toEqual({ buyInCents: 5000, cashOutCents: 9000 });
      expect(result.input?.tournament).toBeUndefined();
    });

    it('requires a positive buy-in', () => {
      const result = buildSessionInput({ ...baseFields, cashBuyIn: '0' });
      expect(result.error).toBe('Cash buy-in is required.');
    });

    it('rejects non-numeric buy-in/cash-out', () => {
      const result = buildSessionInput({ ...baseFields, cashOut: 'lots' });
      expect(result.error).toBe('Buy-in and cash-out must be numbers.');
    });
  });

  describe('tournament', () => {
    const mttFields: LogSessionFormFields = {
      ...baseFields,
      gameType: 'tournament',
      tBuyIn: '100', tFee: '10', tPayout: '400',
      tRebuy: '', tRebuyCount: '', tAddOn: '', tAddOnCount: '',
      tBounty: '', tEntrants: '20', tFinish: '3',
    };

    it('builds a valid tournament session', () => {
      const result = buildSessionInput(mttFields);
      expect(result.error).toBeUndefined();
      expect(result.input?.cash).toBeUndefined();
      expect(result.input?.tournament).toMatchObject({
        buyInCents: 10000, feeCents: 1000, payoutCents: 40000,
        entrants: 20, finishPlace: 3,
      });
    });

    it('requires a positive buy-in', () => {
      const result = buildSessionInput({ ...mttFields, tBuyIn: '0' });
      expect(result.error).toBe('Tournament buy-in is required.');
    });

    it('rejects any non-numeric tournament amount', () => {
      const result = buildSessionInput({ ...mttFields, tBounty: 'some' });
      expect(result.error).toBe('Tournament amounts must be numbers.');
    });

    it('entrants/finishPlace are undefined when left blank', () => {
      const result = buildSessionInput({ ...mttFields, tEntrants: '', tFinish: '' });
      expect(result.input?.tournament?.entrants).toBeUndefined();
      expect(result.input?.tournament?.finishPlace).toBeUndefined();
    });

    describe('THE FIX (B2, audit 2026-08-05): rebuyCount/addOnCount are the REAL typed count', () => {
      it('records the actual number of rebuys/add-ons the user entered', () => {
        const result = buildSessionInput({
          ...mttFields,
          tRebuy: '500', tRebuyCount: '5',
          tAddOn: '200', tAddOnCount: '2',
        });
        expect(result.input?.tournament?.rebuyCount).toBe(5);
        expect(result.input?.tournament?.addOnCount).toBe(2);
      });

      it('is 0 when the count is left blank, REGARDLESS of the money amount entered', () => {
        // This is the exact regression the old code shipped: `rebuyCents! > 0 ? 1 : 0` derived a
        // fake count from whether ANY money was entered. A $500 rebuy total with no count typed
        // must record 0 rebuys, not 1 — the count and the money are independent fields.
        const result = buildSessionInput({
          ...mttFields,
          tRebuy: '500', tRebuyCount: '',
          tAddOn: '200', tAddOnCount: '',
        });
        expect(result.input?.tournament?.rebuyCount).toBe(0);
        expect(result.input?.tournament?.addOnCount).toBe(0);
      });

      it('a single large rebuy and multiple small rebuys are DISTINGUISHABLE by count', () => {
        // The old fabrication made a $50 single rebuy and a $500 five-rebuy session record the
        // IDENTICAL rebuyCount (1) — this is the property that must no longer hold.
        const oneRebuy = buildSessionInput({ ...mttFields, tRebuy: '50', tRebuyCount: '1' });
        const fiveRebuys = buildSessionInput({ ...mttFields, tRebuy: '500', tRebuyCount: '5' });
        expect(oneRebuy.input?.tournament?.rebuyCount).toBe(1);
        expect(fiveRebuys.input?.tournament?.rebuyCount).toBe(5);
        expect(oneRebuy.input?.tournament?.rebuyCount).not.toBe(fiveRebuys.input?.tournament?.rebuyCount);
      });

      it('a count typed with ZERO rebuy money is still honestly 0 rebuys (money still required to be 0 or numeric)', () => {
        const result = buildSessionInput({ ...mttFields, tRebuy: '', tRebuyCount: '3' });
        // Degenerate input (a count with no money) — the count is still recorded as typed; this
        // is a form-honesty concern, not a data-integrity one (rebuyCents legitimately allows 0).
        expect(result.input?.tournament?.rebuyCount).toBe(3);
        expect(result.input?.tournament?.rebuyCents).toBe(0);
      });
    });
  });

  it('trims venue, splits/filters tags, and omits blank optional fields', () => {
    const result = buildSessionInput({
      ...baseFields,
      venue: '  Aria  ',
      durationMin: '90',
      notes: '  went deep  ',
      tags: 'home, , deep,  ',
    });
    expect(result.input?.venue).toBe('Aria');
    expect(result.input?.durationMinutes).toBe(90);
    expect(result.input?.notes).toBe('went deep');
    expect(result.input?.tags).toEqual(['home', 'deep']);
  });

  it('venue/durationMinutes/notes are undefined, tags is [] when left blank', () => {
    const result = buildSessionInput(baseFields);
    expect(result.input?.venue).toBeUndefined();
    expect(result.input?.durationMinutes).toBeUndefined();
    expect(result.input?.notes).toBeUndefined();
    expect(result.input?.tags).toEqual([]);
  });
});
