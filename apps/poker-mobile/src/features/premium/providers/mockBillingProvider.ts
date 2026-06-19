/**
 * Mock billing provider — lets the paywall + upgrade flow work end-to-end with no SDK.
 * A real provider (RevenueCat / StoreKit / Play Billing) implements the same IBillingProvider
 * and returns the same shapes; nothing else changes.
 */
import { PRICING } from '../config';
import type { BillingProduct, IBillingProvider, PurchaseResult } from '../types';

const PRODUCTS: BillingProduct[] = [
  { id: PRICING.monthly.productId, price: PRICING.monthly.price, period: 'month' },
  { id: PRICING.yearly.productId,  price: PRICING.yearly.price,  period: 'year' },
];

export const mockBillingProvider: IBillingProvider = {
  id: 'mock',
  async getProducts() {
    return PRODUCTS;
  },
  async purchase(productId: string): Promise<PurchaseResult> {
    const known = PRODUCTS.some(p => p.id === productId);
    if (!known) return { ok: false, error: 'unknown_product' };
    return { ok: true, entitlement: { plan: 'premium', productId, since: new Date().toISOString() } };
  },
  async restore(): Promise<PurchaseResult> {
    // No server in the mock — the on-device persisted entitlement is the source of truth.
    return { ok: false, error: 'nothing_to_restore' };
  },
};
