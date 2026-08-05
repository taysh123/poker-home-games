import { loadNextGamePlan, saveNextGamePlan, clearNextGamePlan } from '../nextGamePlanStore';
import type { NextGamePlan } from '../../logic/nextGamePlan';

let mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(mockStore[k] ?? null)),
    setItem: jest.fn((k: string, v: string) => { mockStore[k] = v; return Promise.resolve(); }),
    removeItem: jest.fn((k: string) => { delete mockStore[k]; return Promise.resolve(); }),
  },
}));

const plan: NextGamePlan = { mode: 'tournament', crew: ['Alex', 'Dana'], gameDay: '2026-08-01', createdDayKey: '2026-07-25', origin: 'local' };

beforeEach(() => { mockStore = {}; jest.clearAllMocks(); });

describe('nextGamePlanStore', () => {
  it('returns null when nothing is stored', async () => {
    expect(await loadNextGamePlan()).toBeNull();
  });

  it('round-trips a plan', async () => {
    await saveNextGamePlan(plan);
    expect(await loadNextGamePlan()).toEqual(plan);
  });

  it('clears the plan', async () => {
    await saveNextGamePlan(plan);
    await clearNextGamePlan();
    expect(await loadNextGamePlan()).toBeNull();
  });

  it('returns null (never throws) on a corrupt payload', async () => {
    mockStore['tpoker.nextGamePlan.v1'] = '{ not json';
    expect(await loadNextGamePlan()).toBeNull();
  });

  it('rejects an invalid shape and sanitizes the crew on load', async () => {
    mockStore['tpoker.nextGamePlan.v1'] = JSON.stringify({ mode: 'poker', crew: ['A'], createdDayKey: 'x' });
    expect(await loadNextGamePlan()).toBeNull(); // bad mode
    mockStore['tpoker.nextGamePlan.v1'] = JSON.stringify({ mode: 'cash', crew: ['A', 5, 'B'], createdDayKey: '2026-07-25' });
    expect(await loadNextGamePlan()).toEqual({ mode: 'cash', crew: ['A', 'B'], gameDay: undefined, createdDayKey: '2026-07-25', origin: undefined });
  });

  it('preserves a valid origin and drops an unknown one (older payloads load origin-less)', async () => {
    await saveNextGamePlan({ ...plan, origin: 'server' });
    expect((await loadNextGamePlan())?.origin).toBe('server');
    mockStore['tpoker.nextGamePlan.v1'] = JSON.stringify({ mode: 'cash', crew: ['A'], createdDayKey: '2026-07-25', origin: 'cloud' });
    expect((await loadNextGamePlan())?.origin).toBeUndefined();
  });
});
