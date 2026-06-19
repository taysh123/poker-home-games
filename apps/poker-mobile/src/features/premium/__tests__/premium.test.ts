import { loadEntitlement, saveEntitlement, FREE_ENTITLEMENT } from '../data/entitlementStore';
import { mockBillingProvider } from '../providers/mockBillingProvider';
import { getBillingProvider } from '../providers';
import { PRICING, AI_CREDIT_POLICY } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => { await AsyncStorage.clear(); });

describe('entitlement store (fail-closed)', () => {
  it('defaults to free when nothing is stored', async () => {
    expect((await loadEntitlement()).plan).toBe('free');
  });
  it('round-trips a premium entitlement', async () => {
    await saveEntitlement({ plan: 'premium', productId: PRICING.monthly.productId, since: '2026-06-19T00:00:00.000Z' });
    expect((await loadEntitlement()).plan).toBe('premium');
  });
  it('falls back to free on a corrupt payload (fail-closed)', async () => {
    await AsyncStorage.setItem('tpoker.entitlement.v1', '{not json');
    expect((await loadEntitlement()).plan).toBe('free');
  });
});

describe('mock billing provider', () => {
  it('lists the monthly + yearly products', async () => {
    const products = await mockBillingProvider.getProducts();
    expect(products.map(p => p.id)).toEqual([PRICING.monthly.productId, PRICING.yearly.productId]);
  });
  it('purchase grants premium for a known product', async () => {
    const res = await mockBillingProvider.purchase(PRICING.yearly.productId);
    expect(res.ok).toBe(true);
    expect(res.entitlement?.plan).toBe('premium');
  });
  it('purchase rejects an unknown product', async () => {
    expect((await mockBillingProvider.purchase('bogus')).ok).toBe(false);
  });
  it('factory returns a provider (mock fallback)', () => {
    expect(getBillingProvider('revenuecat').id).toBe('mock');
  });
});

describe('pricing + AI policy config', () => {
  it('matches the agreed economics', () => {
    expect(PRICING.monthly.price).toBe('$11.99');
    expect(PRICING.yearly.price).toBe('$79.99');
    expect(AI_CREDIT_POLICY.free.credits).toBe(1);
    expect(AI_CREDIT_POLICY.premium.credits).toBe(30);
  });
});
