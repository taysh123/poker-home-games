import { crewSummary, isGameDay, isPlanStale, type NextGamePlan } from '../nextGamePlan';

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
