import { emptyFile, getUsage, recordAnalysis, loadFile, saveFile } from '../coachStore';
import { emptyUsage, recordUsage } from '../../logic/limits';
import type { CoachAnalysis } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const analysis = (id: string): CoachAnalysis => ({
  id, createdAt: '2026-06-18T12:00:00.000Z', inputKind: 'manual', inputSummary: 'AKs (cash)',
  summary: 's', mistakes: [], goodDecisions: [], alternativeLines: [], tips: [],
  confidence: 'medium', providerId: 'mock', disclaimer: 'd',
});

beforeEach(async () => { await AsyncStorage.clear(); });

describe('account-keyed usage', () => {
  it('tracks usage per account, not globally', () => {
    let file = emptyFile();
    const t = Date.now();
    file = recordAnalysis(file, 'acct:A', analysis('1'), recordUsage(getUsage(file, 'acct:A'), t));
    file = recordAnalysis(file, 'acct:A', analysis('2'), recordUsage(getUsage(file, 'acct:A'), t));
    file = recordAnalysis(file, 'guest', analysis('3'), recordUsage(getUsage(file, 'guest'), t));

    expect(getUsage(file, 'acct:A').usedThisMonth).toBe(2);
    expect(getUsage(file, 'guest').usedThisMonth).toBe(1);
    expect(getUsage(file, 'acct:B').usedThisMonth).toBe(0); // unseen account starts fresh
    expect(file.history).toHaveLength(3);
  });
});

describe('persistence + migration', () => {
  it('round-trips the account-keyed file', async () => {
    let file = emptyFile();
    file = recordAnalysis(file, 'acct:A', analysis('1'), recordUsage(emptyUsage(), Date.now()));
    await saveFile(file);
    const loaded = await loadFile();
    expect(getUsage(loaded, 'acct:A').usedThisMonth).toBe(1);
  });

  it('migrates a pre-account single-usage payload into the guest scope', async () => {
    const legacy = JSON.stringify({ schemaVersion: 1, usage: { schemaVersion: 1, monthKey: '2026-06', usedThisMonth: 4 }, history: [] });
    await AsyncStorage.setItem('tpoker.coach.v1', legacy);
    const loaded = await loadFile();
    expect(getUsage(loaded, 'guest').usedThisMonth).toBe(4);
  });
});
