import { crewSummary, gameDayLabel, isGameDay, isPlanConsumed, isPlanStale, planNudgeLine, planToastText, type NextGamePlan } from '../nextGamePlan';

const plan = (over: Partial<NextGamePlan> = {}): NextGamePlan => ({
  mode: 'cash',
  crew: ['Alex', 'Dana'],
  createdDayKey: '2026-07-25',
  ...over,
});

describe('crewSummary', () => {
  it('lists everyone when the crew fits under the cap', () => {
    expect(crewSummary([])).toBe('');
    expect(crewSummary(['Alex'])).toBe('Alex');
    expect(crewSummary(['Alex', 'Dana', 'Sam'])).toBe('Alex, Dana, Sam');
  });

  it('caps the list and appends "+N" for the overflow', () => {
    expect(crewSummary(['Alex', 'Dana', 'Sam', 'Jo'])).toBe('Alex, Dana, Sam +1');
    expect(crewSummary(['Alex', 'Dana', 'Sam', 'Jo', 'Kim'])).toBe('Alex, Dana, Sam +2');
  });
});

describe('isGameDay', () => {
  it('is true only when the plan is dated for today', () => {
    expect(isGameDay(plan({ gameDay: '2026-08-01' }), '2026-08-01')).toBe(true);
    expect(isGameDay(plan({ gameDay: '2026-08-01' }), '2026-07-31')).toBe(false);
    expect(isGameDay(plan({ gameDay: undefined }), '2026-08-01')).toBe(false);
  });
});

describe('gameDayLabel', () => {
  it('says "Tonight" on the game day itself', () => {
    expect(gameDayLabel('2026-08-01', '2026-08-01')).toBe('Tonight');
  });

  it('formats a future day as weekday + short date, parsed as LOCAL components (never UTC)', () => {
    // 2026-08-01 is a Saturday. Component parsing keeps this correct in every timezone —
    // new Date('2026-08-01') would be UTC midnight and could render Jul 31 in negative offsets.
    expect(gameDayLabel('2026-08-01', '2026-07-25')).toBe('Sat, Aug 1');
    expect(gameDayLabel('2026-12-09', '2026-07-25')).toBe('Wed, Dec 9');
  });

  it('is empty for an undated plan (caller hides the line)', () => {
    expect(gameDayLabel(undefined, '2026-08-01')).toBe('');
  });
});

describe('plan copy is platform-honest (web has no notifications — never promise a nudge there)', () => {
  it('native copy promises the game-day nudge; web copy points at the Home card instead', () => {
    expect(planNudgeLine('Alex, Dana', false)).toBe("We'll line up Alex, Dana and nudge you on game day.");
    expect(planNudgeLine('Alex, Dana', true)).not.toMatch(/nudge/i);
    expect(planToastText(false)).toBe("Next game planned — we'll nudge you on game day.");
    expect(planToastText(true)).not.toMatch(/nudge/i);
  });
});

describe('isPlanConsumed', () => {
  it('a dated plan is consumed from its game day onward — end-game screens re-offer planning', () => {
    expect(isPlanConsumed(plan({ gameDay: '2026-08-01' }), '2026-08-01')).toBe(true); // game day itself
    expect(isPlanConsumed(plan({ gameDay: '2026-07-31' }), '2026-08-01')).toBe(true); // past
    expect(isPlanConsumed(plan({ gameDay: '2026-08-02' }), '2026-08-01')).toBe(false); // future
    expect(isPlanConsumed(plan({ gameDay: undefined }), '2026-08-01')).toBe(false); // undated persists
  });
});

describe('isPlanStale', () => {
  it('is stale once a dated plan\'s game day has passed (lexicographic day-key compare)', () => {
    expect(isPlanStale(plan({ gameDay: '2026-07-31' }), '2026-08-01')).toBe(true); // past
    expect(isPlanStale(plan({ gameDay: '2026-08-01' }), '2026-08-01')).toBe(false); // today, still valid
    expect(isPlanStale(plan({ gameDay: '2026-08-02' }), '2026-08-01')).toBe(false); // future
  });

  it('an undated plan never goes stale by date (persists until used/cleared)', () => {
    expect(isPlanStale(plan({ gameDay: undefined }), '2026-08-01')).toBe(false);
  });
});
