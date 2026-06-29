/**
 * RevenueCat billing provider — NATIVE (iOS/Android) production billing seam.
 *
 * KEY-GATED STUB. The native SDK (`react-native-purchases`) is intentionally NOT installed yet — it's a native
 * module with no web support and requires the RevenueCat account (a deferred external step). Every method throws
 * "not configured" so the adapter is inert and the mock provider stays active (OFF no-op). The exact wiring once
 * the SDK + key exist is sketched below.
 *
 * Server-authoritative: after a successful native purchase, the client calls
 * `validatePurchase('revenuecat', <appUserId>)` so the SERVER verifies with RevenueCat and computes the
 * entitlement — never client-side.
 *
 * Implementation sketch once react-native-purchases + EXPO_PUBLIC_REVENUECAT_API_KEY are available:
 *   import Purchases from 'react-native-purchases';
 *   Purchases.configure({ apiKey: BILLING_KEYS.revenueCatApiKey, appUserID: <userId> });
 *   getProducts → Purchases.getOfferings(); map offerings.current.availablePackages → BillingProduct[]
 *   purchase   → Purchases.purchasePackage(pkg); then validatePurchase('revenuecat', await Purchases.getAppUserID(), token)
 *   restore    → Purchases.restorePurchases(); then re-read the server entitlement
 *
 * Wiring checklist: docs/commercial/billing-architecture.md.
 */
import type { BillingProduct, IBillingProvider, PurchaseResult } from '../types';

const NOT_CONFIGURED =
  'RevenueCat billing is not configured. Install react-native-purchases, set EXPO_PUBLIC_REVENUECAT_API_KEY ' +
  '(public SDK key) + the server RevenueCatSettings, then implement the SDK calls. ' +
  'See docs/commercial/billing-architecture.md.';

function requireConfigured(): never {
  throw new Error(NOT_CONFIGURED);
}

export const revenueCatBillingProvider: IBillingProvider = {
  id: 'revenuecat',
  async getProducts(): Promise<BillingProduct[]> { return requireConfigured(); },
  async purchase(_productId: string): Promise<PurchaseResult> { return requireConfigured(); },
  async restore(): Promise<PurchaseResult> { return requireConfigured(); },
};
