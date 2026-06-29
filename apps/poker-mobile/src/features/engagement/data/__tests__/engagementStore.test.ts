import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadState, saveState, emptyState } from '../engagementStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => { await AsyncStorage.clear(); });

describe('engagementStore', () => {
  it('returns empty state when nothing stored', async () => {
    expect((await loadState()).lastXp).toBe(0);
    expect((await loadState()).seenAchievements).toEqual({});
  });

  it('round-trips state', async () => {
    await saveState({ schemaVersion: 1, seenAchievements: { coach_first: '2026-06-20T00:00:00.000Z' }, lastXp: 120 });
    const loaded = await loadState();
    expect(loaded.lastXp).toBe(120);
    expect(loaded.seenAchievements.coach_first).toBeTruthy();
  });

  it('quarantines a corrupt payload and falls back to empty (fail-closed)', async () => {
    await AsyncStorage.setItem('tpoker.engagement.v1', '{not json');
    const loaded = await loadState();
    expect(loaded).toEqual(emptyState());
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some(k => k.startsWith('tpoker.engagement.quarantine.'))).toBe(true);
  });
});
