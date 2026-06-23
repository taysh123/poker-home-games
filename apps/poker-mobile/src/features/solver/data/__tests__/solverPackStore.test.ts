import AsyncStorage from '@react-native-async-storage/async-storage';
import { importAndStore, loadPacks } from '../solverPackStore';
import { invalidSolverPack, validSolverPack } from '../../pack/__fixtures__/solverPackFixtures';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('solverPackStore (fail-closed + quarantine)', () => {
  it('starts empty', async () => {
    expect(await loadPacks()).toEqual([]);
  });

  it('promotes a valid pack', async () => {
    const res = await importAndStore(validSolverPack());
    expect(res.ok).toBe(true);
    expect(res.packId).toBe('fixture-solver-1');
    const packs = await loadPacks();
    expect(packs).toHaveLength(1);
    expect(packs[0].manifest.id).toBe('fixture-solver-1');
  });

  it('quarantines an invalid pack (not promoted)', async () => {
    const res = await importAndStore(invalidSolverPack());
    expect(res.ok).toBe(false);
    expect(await loadPacks()).toHaveLength(0);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some(k => k.startsWith('tpoker.solverPacks.quarantine.'))).toBe(true);
  });

  it('re-importing the same id replaces (no duplicate)', async () => {
    await importAndStore(validSolverPack());
    await importAndStore(validSolverPack());
    expect(await loadPacks()).toHaveLength(1);
  });
});
