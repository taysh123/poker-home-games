/**
 * RevenueCat billing provider — NATIVE (iOS/Android) production billing seam.
 *
 * INACTIVE typed stub. It does NOT talk to RevenueCat: the SDK (`react-native-purchases`),
 * the RevenueCat API key, and the store products/offerings are not configured yet. Every method
 * throws a clear "not configured" error so nothing can mistake it for a working purchase path —
 * we never fake a successful purchase. The active provider stays `mock` until this is wired (see
 * `getBillingProvider` default), so production behaviour is unchanged.
 *
 * Wiring checklist + verification boundary: docs/commercial/billing-architecture.md.
 */
import type { BillingProduct, IBillingProvider, PurchaseResult } from '../types';

const NOT_CONFIGURED =
  'RevenueCat billing is not configured. Install react-native-purchases, set the RevenueCat API ' +
  'key, and configure store products/offerings, then route entitlement through the server verifier. ' +
  'See docs/commercial/billing-architecture.md.';

export const revenueCatBillingProvider: IBillingProvider = {
  id: 'revenuecat',
  // async (not sync-throw): callers await / .catch() these; a rejected promise is catchable, a
  // synchronous throw from a "() => Promise" is not. Matches the mock provider's contract.
  async getProducts(): Promise<BillingProduct[]> {
    throw new Error(NOT_CONFIGURED);
  },
  async purchase(_productId: string): Promise<PurchaseResult> {
    throw new Error(NOT_CONFIGURED);
  },
  async restore(): Promise<PurchaseResult> {
    throw new Error(NOT_CONFIGURED);
  },
};
