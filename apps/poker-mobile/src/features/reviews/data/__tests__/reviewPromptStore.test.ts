import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_COUNTED_KEYS } from '../../logic/reviewPromptLogic';
import {
  REVIEW_PROMPT_KEY,
  defaultReviewPromptState,
  loadReviewPromptState,
  saveReviewPromptState,
} from '../reviewPromptStore';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    getItem: jest.fn(async (k: string) => (mem.has(k) ? mem.get(k)! : null)),
    setItem: jest.fn(async (k: string, v: string) => { mem.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mem.delete(k); }),
    __mem: mem,
  };
});

const mem = (AsyncStorage as unknown as { __mem: Map<string, string> }).__mem;
const NOW = new Date(2026, 6, 28, 12, 0, 0).getTime();

beforeEach(() => {
  mem.clear();
  jest.clearAllMocks();
});

describe('reviewPromptStore', () => {
  it('stamps installedAt on the first load and persists it', async () => {
    const s = await loadReviewPromptState(NOW);
    expect(s.installedAt).toBe(NOW);
    expect(mem.get(REVIEW_PROMPT_KEY)).toContain(String(NOW));
  });

  it('does not re-stamp installedAt on a later load', async () => {
    await loadReviewPromptState(NOW);
    expect((await loadReviewPromptState(NOW + 10_000)).installedAt).toBe(NOW);
  });

  it('falls back to defaults on a corrupt payload without throwing', async () => {
    mem.set(REVIEW_PROMPT_KEY, '{not json');
    expect(await loadReviewPromptState(NOW)).toEqual(defaultReviewPromptState(NOW));
  });

  it('falls back to defaults when fields have the wrong types', async () => {
    mem.set(REVIEW_PROMPT_KEY, JSON.stringify({ installedAt: 'yesterday', moments: null }));
    expect(await loadReviewPromptState(NOW)).toEqual(defaultReviewPromptState(NOW));
  });

  it('rejects a payload whose promptedVersions holds non-strings', async () => {
    mem.set(REVIEW_PROMPT_KEY, JSON.stringify({ ...defaultReviewPromptState(NOW), promptedVersions: [1, 2] }));
    expect(await loadReviewPromptState(NOW)).toEqual(defaultReviewPromptState(NOW));
  });

  it('rejects a payload missing countedKeys (pre-rework shape)', async () => {
    const { countedKeys, ...legacy } = defaultReviewPromptState(NOW);
    void countedKeys;
    mem.set(REVIEW_PROMPT_KEY, JSON.stringify(legacy));
    expect(await loadReviewPromptState(NOW)).toEqual(defaultReviewPromptState(NOW));
  });

  it('round-trips a saved state', async () => {
    const s = { ...defaultReviewPromptState(NOW), moments: 4, promptedVersions: ['1.2.0'], countedKeys: ['g1'] };
    await saveReviewPromptState(s);
    expect(await loadReviewPromptState(NOW + 1)).toEqual(s);
  });

  it('bounds countedKeys so the dedupe list cannot grow forever', async () => {
    const many = Array.from({ length: MAX_COUNTED_KEYS + 20 }, (_, i) => `g${i}`);
    await saveReviewPromptState({ ...defaultReviewPromptState(NOW), countedKeys: many });
    const loaded = await loadReviewPromptState(NOW);
    expect(loaded.countedKeys).toHaveLength(MAX_COUNTED_KEYS);
    // Keeps the MOST RECENT keys — dropping those would let a recent game be counted twice.
    expect(loaded.countedKeys[loaded.countedKeys.length - 1]).toBe(`g${MAX_COUNTED_KEYS + 19}`);
  });

  it('never throws when the write fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(saveReviewPromptState(defaultReviewPromptState(NOW))).resolves.toBeUndefined();
  });

  it('never throws when the read fails', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    await expect(loadReviewPromptState(NOW)).resolves.toEqual(defaultReviewPromptState(NOW));
  });
});
