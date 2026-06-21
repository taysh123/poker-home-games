/**
 * Billing provider registry — vendor-agnostic seam. The rest of the app depends only on
 * `IBillingProvider`, so swapping the active provider here is the only change needed when a real
 * billing SDK is wired.
 *
 * ACTIVE PROVIDER IS `mock` BY DEFAULT. `getBillingProvider()` with no argument returns the mock,
 * which is what `PremiumContext` calls — so production behaviour is unchanged until billing is
 * genuinely configured. The `revenuecat` (native) and `stripe` (web) entries are typed stubs whose
 * methods throw "not configured" (see their files) — they never fake a purchase. The platform
 * resolver below is exported for the eventual flip but is NOT called on the default path.
 */
import { Platform } from 'react-native';
import type { IBillingProvider } from '../types';
import { mockBillingProvider } from './mockBillingProvider';
import { revenueCatBillingProvider } from './revenueCatBillingProvider';
import { stripeBillingProvider } from './stripeBillingProvider';

export type BillingProviderId = 'mock' | 'revenuecat' | 'stripe';

/**
 * Resolve a provider by id. Defaults to `mock`. Unknown ids fall back to `mock` (fail-safe) so a
 * misconfigured id can never hard-crash the app — it degrades to the no-op mock instead.
 */
export function getBillingProvider(id: BillingProviderId = 'mock'): IBillingProvider {
  switch (id) {
    case 'mock':
      return mockBillingProvider;
    case 'revenuecat':
      return revenueCatBillingProvider; // native stub — throws until configured
    case 'stripe':
      return stripeBillingProvider; // web stub — throws until configured
    default:
      return mockBillingProvider; // fail-safe default
  }
}

/**
 * Which real provider id is correct for a given platform (pure; testable without mocking Platform):
 * web → Stripe, native (iOS/Android) → RevenueCat. Per the commercial decision record.
 */
export function billingProviderIdForPlatform(os: string): BillingProviderId {
  return os === 'web' ? 'stripe' : 'revenuecat';
}

/**
 * The provider that WOULD be active for this platform once real billing is turned on. INACTIVE by
 * default — nothing calls this on the default path (PremiumContext uses `getBillingProvider()` →
 * mock). It exists so the flip is a one-line change here, and so the wiring is testable now.
 */
export function resolvePlatformBillingProvider(): IBillingProvider {
  return getBillingProvider(billingProviderIdForPlatform(Platform.OS));
}
