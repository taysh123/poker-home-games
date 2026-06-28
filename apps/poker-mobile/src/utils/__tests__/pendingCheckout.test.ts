import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { savePendingCheckout, consumePendingCheckout } from '../pendingCheckout';

beforeEach(async () => { await AsyncStorage.clear(); jest.useRealTimers(); });

describe('pendingCheckout stash', () => {
  it('round-trips a stashed plan', async () => {
    await savePendingCheckout('yearly');
    expect(await consumePendingCheckout()).toBe('yearly');
  });

  it('is single-use — consume clears it', async () => {
    await savePendingCheckout('monthly');
    expect(await consumePendingCheckout()).toBe('monthly');
    expect(await consumePendingCheckout()).toBeNull();
  });

  it('returns null when nothing is stashed', async () => {
    expect(await consumePendingCheckout()).toBeNull();
  });

  it('expires after the 15-minute TTL', async () => {
    const realNow = Date.now;
    const base = 1_700_000_000_000;
    Date.now = () => base;
    await savePendingCheckout('yearly');
    Date.now = () => base + 15 * 60 * 1000 + 1; // 1ms past TTL
    expect(await consumePendingCheckout()).toBeNull();
    Date.now = realNow;
  });

  it('fails closed on a corrupt payload', async () => {
    await AsyncStorage.setItem('tpoker.pendingCheckout', '{not json');
    expect(await consumePendingCheckout()).toBeNull();
  });

  it('rejects an unknown plan value', async () => {
    await AsyncStorage.setItem(
      'tpoker.pendingCheckout',
      JSON.stringify({ plan: 'bogus', at: Date.now() }),
    );
    expect(await consumePendingCheckout()).toBeNull();
  });
});
