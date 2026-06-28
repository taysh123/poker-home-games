/**
 * Billing provider registry — vendor-agnostic seam. The rest of the app depends only on
 * `IBillingProvider`, so swapping the active provider here is the only change needed when a real
 * billing SDK is wired.
 *
 * ACTIVE PROVIDER IS `mock` BY DEFAULT. `getBillingProvider()` with no argument returns the mock,
 * which is what `PremiumContext` calls when no billing keys are configured — so production behaviour
 * is unchanged until keys are genuinely supplied. The `revenuecat` (native), `stripe` (web, legacy),
 * and `paddle` (web, current) entries are typed stubs / real adapters whose methods are key-gated
 * or throw "not configured" — they never fake a purchase.
 *
 * ACTIVE SELECTION: use `resolveActiveBillingProvider()` (key-gated, fail-closed):
 *   web + EXPO_PUBLIC_PADDLE_CLIENT_TOKEN present → paddle
 *   native + EXPO_PUBLIC_REVENUECAT_API_KEY present → revenuecat
 *   else → mock (safe no-op)
 */
import { Platform } from 'react-native';
import type { IBillingProvider } from '../types';
import { BILLING_KEYS } from '../config';
import { mockBillingProvider } from './mockBillingProvider';
import { revenueCatBillingProvider } from './revenueCatBillingProvider';
import { stripeBillingProvider } from './stripeBillingProvider';
import { paddleBillingProvider } from './paddleBillingProvider';

export type BillingProviderId = 'mock' | 'revenuecat' | 'stripe' | 'paddle';

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
      return stripeBillingProvider; // web stub (legacy) — throws until configured
    case 'paddle':
      return paddleBillingProvider; // web Paddle overlay — key-gated, fail-closed
    default:
      return mockBillingProvider; // fail-safe default
  }
}

/**
 * Which real provider id is correct for a given platform (pure; testable without mocking Platform):
 * web → Stripe (legacy mapping, kept for existing tests), native (iOS/Android) → RevenueCat.
 * For the ACTIVE selection path (Paddle on web), use resolveActiveBillingProviderId instead.
 */
export function billingProviderIdForPlatform(os: string): BillingProviderId {
  return os === 'web' ? 'stripe' : 'revenuecat';
}

/**
 * The provider that WOULD be active for this platform once real billing is turned on (legacy helper).
 * Uses billingProviderIdForPlatform (web → stripe). For the Paddle-based active selection,
 * use resolveActiveBillingProvider() instead.
 */
export function resolvePlatformBillingProvider(): IBillingProvider {
  return getBillingProvider(billingProviderIdForPlatform(Platform.OS));
}

/**
 * PURE, TESTABLE provider-id resolver (Paddle edition). Real billing is KEY-GATED + fail-closed:
 *   web → 'paddle' when paddleClientToken is non-empty (else 'mock') — never a live charge while
 *           unconfigured; provider returns { ok: false, error: 'not_configured' } if somehow reached.
 *   native → 'revenuecat' when its key is present (else 'mock').
 *   Defaults are always 'mock' so no prod change until keys are supplied.
 *
 * @param os - Platform.OS value ('web', 'ios', 'android', …)
 * @param paddleClientToken - EXPO_PUBLIC_PADDLE_CLIENT_TOKEN (empty string = not configured)
 * @param revenueCatApiKey  - EXPO_PUBLIC_REVENUECAT_API_KEY (empty string = not configured)
 */
export function resolveActiveBillingProviderId(
  os: string,
  paddleClientToken: string,
  revenueCatApiKey = '',
): BillingProviderId {
  if (os === 'web') return paddleClientToken ? 'paddle' : 'mock';
  return revenueCatApiKey ? 'revenuecat' : 'mock';
}

/**
 * The provider that is active RIGHT NOW, given the current platform and configured keys.
 * Fail-closed to mock: unconfigured → mock (safe no-op, no live charge).
 * Used by PremiumContext instead of the hardcoded getBillingProvider() (mock) call.
 */
export function resolveActiveBillingProvider(): IBillingProvider {
  return getBillingProvider(
    resolveActiveBillingProviderId(
      Platform.OS,
      BILLING_KEYS.paddleClientToken,
      BILLING_KEYS.revenueCatApiKey,
    ),
  );
}
