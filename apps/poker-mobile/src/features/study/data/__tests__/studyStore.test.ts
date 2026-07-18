// apps/poker-mobile/src/features/study/data/__tests__/studyStore.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadFile, saveFile, emptyFile } from '../studyStore';
import { emptyDailyCounters } from '../../logic/dailyLimits';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const KEY = 'tpoker.study.v1';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('emptyFile', () => {
  it('is schema v2 with defaulted Phase 1 fields', () => {
    const f = emptyFile();
    expect(f.schemaVersion).toBe(2);
    expect(f.progress.dailyLimitCounters).toEqual(emptyDailyCounters());
    expect(f.progress.quizzesCompleted).toBe(0);
    expect(f.progress.lessonsCompleted).toBe(0);
  });
});

describe('loadFile', () => {
  it('returns an empty v2 file when storage is empty', async () => {
    const f = await loadFile();
    expect(f.schemaVersion).toBe(2);
  });

  it('migrates a v1 payload to v2 WITHOUT quarantine, preserving existing progress', async () => {
    const v1 = {
      schemaVersion: 1,
      progress: {
        schemaVersion: 1,
        totalAnswered: 7,
        totalCorrect: 4,
        dailyGoal: 10,
        dailyCounts: { '2026-06-20': 3 },
        currentStreak: 2,
        longestStreak: 5,
      },
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(v1));

    const f = await loadFile();
    expect(f.schemaVersion).toBe(2);
    expect(f.progress.totalAnswered).toBe(7);          // preserved
    expect(f.progress.longestStreak).toBe(5);          // preserved
    expect(f.progress.dailyLimitCounters).toEqual(emptyDailyCounters()); // defaulted
    expect(f.progress.quizzesCompleted).toBe(0);       // defaulted

    // v1 payload was migrated, not quarantined.
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some(k => k.startsWith('tpoker.study.quarantine.'))).toBe(false);
  });

  it('quarantines a corrupt payload and returns an empty file', async () => {
    await AsyncStorage.setItem(KEY, '{ not json');
    const f = await loadFile();
    expect(f.schemaVersion).toBe(2);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some(k => k.startsWith('tpoker.study.quarantine.'))).toBe(true);
    expect(await AsyncStorage.getItem(KEY)).toBeNull(); // removed after quarantine
  });

  it('round-trips a saved v2 file', async () => {
    const f = emptyFile();
    f.progress.quizzesCompleted = 3;
    f.progress.dailyLimitCounters = { quiz: { dayKey: '2026-06-25', count: 1 }, trainerSession: { dayKey: '', count: 0 }, practiceQuestion: { dayKey: '', count: 0 } };
    await saveFile(f);
    const loaded = await loadFile();
    expect(loaded.progress.quizzesCompleted).toBe(3);
    expect(loaded.progress.dailyLimitCounters!.quiz).toEqual({ dayKey: '2026-06-25', count: 1 });
  });
});
