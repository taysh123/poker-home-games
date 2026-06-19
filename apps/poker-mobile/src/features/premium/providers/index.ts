/**
 * Billing provider registry — vendor-agnostic seam. Swap the active provider here when a
 * real billing SDK is wired; the rest of the app is unchanged.
 */
import type { IBillingProvider } from '../types';
import { mockBillingProvider } from './mockBillingProvider';

export type BillingProviderId = 'mock' | 'revenuecat' | 'storekit' | 'play';

export function getBillingProvider(id: BillingProviderId = 'mock'): IBillingProvider {
  switch (id) {
    case 'mock':
      return mockBillingProvider;
    // case 'revenuecat': return revenueCatProvider; // TODO when the SDK is added
    default:
      return mockBillingProvider; // fail-safe default
  }
}
