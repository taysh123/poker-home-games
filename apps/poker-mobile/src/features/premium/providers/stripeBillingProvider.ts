/**
 * Stripe billing provider — WEB production billing seam (Stripe Checkout + Customer Portal).
 *
 * INACTIVE typed stub. No Stripe publishable key, price IDs, Checkout session endpoint, or webhook
 * backend are wired yet. Every method throws a clear "not configured" error — we never fake a
 * successful purchase. The active provider stays `mock` until this is wired, so production behaviour
 * is unchanged.
 *
 * Server-authoritative by design: a web purchase redirects to Stripe Checkout and entitlement is
 * granted ONLY after the backend verifies the Stripe webhook (`checkout.session.completed`) — never
 * from the client. `restore()` re-syncs entitlement from the server, it does not grant locally.
 *
 * Wiring checklist + verification boundary: docs/commercial/billing-architecture.md.
 */
import type { BillingProduct, IBillingProvider, PurchaseResult } from '../types';

const NOT_CONFIGURED =
  'Stripe billing is not configured. Set the Stripe publishable key + price IDs, add the Checkout ' +
  'session endpoint and the checkout.session.completed webhook on the server, and grant entitlement ' +
  'only from the verified webhook. See docs/commercial/billing-architecture.md.';

export const stripeBillingProvider: IBillingProvider = {
  id: 'stripe',
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
