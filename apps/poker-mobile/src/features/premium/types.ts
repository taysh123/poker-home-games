/**
 * Billing/entitlement types. Vendor-agnostic: the app depends only on `IBillingProvider`,
 * so RevenueCat / StoreKit / Play Billing slot in behind it with no UI changes. The active
 * entitlement is persisted on-device now (mock); real receipts / server become authoritative later.
 */
import type { BillingPeriod, PremiumTier } from './config';

export const ENTITLEMENT_SCHEMA_VERSION = 1 as const;

/** Persisted entitlement state — the device's current plan. */
export interface EntitlementState {
  plan: PremiumTier;
  productId?: string;
  since?: string; // ISO
}

export interface BillingProduct {
  id: string;
  price: string;
  period: BillingPeriod;
}

export interface PurchaseResult {
  ok: boolean;
  entitlement?: EntitlementState;
  error?: string;
}

/** The vendor-agnostic billing seam. */
export interface IBillingProvider {
  readonly id: string;
  getProducts(): Promise<BillingProduct[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}
