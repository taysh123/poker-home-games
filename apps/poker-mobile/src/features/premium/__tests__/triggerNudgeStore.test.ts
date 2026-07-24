// In-memory AsyncStorage so the persistence seam is testable without a native module.
let mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((k: string) => Promise.resolve(mockStore[k] ?? null)),
    setItem: jest.fn((k: string, v: string) => {
      mockStore[k] = v;
      return Promise.resolve();
    }),
  },
}));

import { loadNudgeShownState, saveNudgeShownState } from '../triggerNudgeStore';

beforeEach(() => {
  mockStore = {};
  jest.clearAllMocks();
});

describe('triggerNudgeStore — last-shown persistence seam', () => {
  it('returns an empty map when nothing is stored', async () => {
    expect(await loadNudgeShownState()).toEqual({});
  });

  it('round-trips a valid state', async () => {
    await saveNudgeShownState({ quiz_daily_limit: 123, profile_teaser: 456 });
    expect(await loadNudgeShownState()).toEqual({ quiz_daily_limit: 123, profile_teaser: 456 });
  });

  it('returns an empty map (never throws) on a corrupt payload', async () => {
    mockStore['tpoker.triggerNudge.v1'] = '{ not json';
    expect(await loadNudgeShownState()).toEqual({});
  });

  it('drops unknown trigger ids and non-finite timestamps on load (fail-safe)', async () => {
    mockStore['tpoker.triggerNudge.v1'] = JSON.stringify({
      quiz_daily_limit: 100, // valid
      not_a_trigger: 200, // unknown id → dropped
      profile_teaser: 'soon', // non-number → dropped
      lesson_locked: null, // null → dropped
    });
    expect(await loadNudgeShownState()).toEqual({ quiz_daily_limit: 100 });
  });
});
