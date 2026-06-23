/**
 * Billing provider scaffold — proves the registry/resolver wiring is honest:
 *  - the active (default) provider stays `mock` → OFF-state no-op, production unchanged;
 *  - the real provider stubs THROW "not configured" and never fake a successful purchase;
 *  - the platform resolver maps web → Stripe, native → RevenueCat.
 */
import { Platform } from 'react-native';
import {
  getBillingProvider,
  billingProviderIdForPlatform,
  resolvePlatformBillingProvider,
} from '../providers';
import * as monetizationApi from '../../../api/monetizationApi';

describe('billing registry — default is the no-op mock', () => {
  it('getBillingProvider() defaults to mock (the provider PremiumContext uses)', () => {
    expect(getBillingProvider().id).toBe('mock');
  });

  it('the default mock provider resolves products + purchase without throwing (OFF-state no-op)', async () => {
    const mock = getBillingProvider();
    await expect(mock.getProducts()).resolves.toBeInstanceOf(Array);
    // mock keeps the existing on-device behaviour — it does not throw like the real stubs do.
    const res = await mock.purchase('tpoker.premium.monthly');
    expect(res.ok).toBe(true);
  });
});

describe('real provider stubs — reachable by id, but throw (never fake success)', () => {
  it('revenuecat resolves to the native stub', () => {
    expect(getBillingProvider('revenuecat').id).toBe('revenuecat');
  });

  it('stripe resolves to the web stub', () => {
    expect(getBillingProvider('stripe').id).toBe('stripe');
  });

  it('revenuecat stub rejects every method with "not configured"', async () => {
    const p = getBillingProvider('revenuecat');
    await expect(p.getProducts()).rejects.toThrow(/not configured/i);
    await expect(p.purchase('x')).rejects.toThrow(/not configured/i);
    await expect(p.restore()).rejects.toThrow(/not configured/i);
  });

  it('stripe stub rejects every method with "not configured"', async () => {
    const p = getBillingProvider('stripe');
    await expect(p.getProducts()).rejects.toThrow(/not configured/i);
    await expect(p.purchase('x')).rejects.toThrow(/not configured/i);
    await expect(p.restore()).rejects.toThrow(/not configured/i);
  });

  it('a stub purchase never returns a faked { ok: true }', async () => {
    await expect(getBillingProvider('stripe').purchase('tpoker.premium.yearly')).rejects.toBeDefined();
  });
});

describe('platform resolver (inactive by default)', () => {
  it('maps web → stripe and native → revenuecat (pure)', () => {
    expect(billingProviderIdForPlatform('web')).toBe('stripe');
    expect(billingProviderIdForPlatform('ios')).toBe('revenuecat');
    expect(billingProviderIdForPlatform('android')).toBe('revenuecat');
  });

  it('resolvePlatformBillingProvider() returns a real platform provider for the test runtime', () => {
    const expectedId = billingProviderIdForPlatform(Platform.OS);
    expect(['revenuecat', 'stripe']).toContain(expectedId);
    expect(resolvePlatformBillingProvider().id).toBe(expectedId);
  });
});

describe('billing client API surface (server-authoritative)', () => {
  it('exposes the server checkout + validate calls', () => {
    expect(typeof monetizationApi.createCheckoutSession).toBe('function');
    expect(typeof monetizationApi.validatePurchase).toBe('function');
  });
});
