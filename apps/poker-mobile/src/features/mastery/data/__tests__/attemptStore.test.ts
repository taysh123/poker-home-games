/**
 * Mastery attempt store tests (Phase B5) — pure recordAttempt + AsyncStorage round-trip + quarantine.
 */
import { emptyFile, recordAttempt, loadFile, saveFile } from '../attemptStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NOW = 1_750_000_000_000;

beforeEach(async () => { await AsyncStorage.clear(); });

describe('recordAttempt (pure)', () => {
  it('builds per-key stats incrementally + immutably', () => {
    let f = emptyFile();
    f = recordAttempt(f, 'cat:RFI', true, NOW);
    f = recordAttempt(f, 'cat:RFI', false, NOW + 1);
    f = recordAttempt(f, 'LO-001', true, NOW + 2);
    expect(f.statsByKey['cat:RFI']).toEqual({ attempts: 2, correct: 1, lastActivityTs: NOW + 1 });
    expect(f.statsByKey['LO-001']).toEqual({ attempts: 1, correct: 1, lastActivityTs: NOW + 2 });
  });
});

describe('persistence + quarantine', () => {
  it('round-trips the file', async () => {
    let f = emptyFile();
    f = recordAttempt(f, 'cat:ICM', true, NOW);
    await saveFile(f);
    const loaded = await loadFile();
    expect(loaded.statsByKey['cat:ICM']).toEqual({ attempts: 1, correct: 1, lastActivityTs: NOW });
  });

  it('returns empty when nothing stored', async () => {
    expect((await loadFile()).statsByKey).toEqual({});
  });

  it('quarantines a corrupt payload and returns empty (never throws / never loses silently)', async () => {
    await AsyncStorage.setItem('tpoker.masteryAttempts.v1', '{ not valid json');
    const loaded = await loadFile();
    expect(loaded.statsByKey).toEqual({});
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some(k => k.startsWith('tpoker.masteryAttempts.quarantine.'))).toBe(true);
    expect(keys).not.toContain('tpoker.masteryAttempts.v1'); // cleared after quarantine
  });

  it('quarantines a wrong-shape payload (array statsByKey)', async () => {
    await AsyncStorage.setItem('tpoker.masteryAttempts.v1', JSON.stringify({ schemaVersion: 1, statsByKey: [] }));
    const loaded = await loadFile();
    expect(loaded.statsByKey).toEqual({});
  });
});
