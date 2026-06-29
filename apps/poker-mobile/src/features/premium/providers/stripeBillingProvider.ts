/**
 * Stripe billing provider — WEB production billing seam (Stripe Checkout, server-authoritative).
 *
 * WIRED but KEY-GATED. When EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is empty (the default), every method throws
 * "not configured" so the adapter is inert and the mock provider stays active (OFF no-op, production unchanged).
 * When the key is present, `purchase()` asks the SERVER to create a Checkout session, opens it, and then
 * re-reads the server entitlement — premium is granted ONLY after the backend's Stripe webhook verifies the
 * payment (`checkout.session.completed`), never client-side. `restore()` re-syncs from the server.
 *
 * Wiring checklist: docs/commercial/billing-architecture.md.
 */
import * as SecureStore from '../../../utils/storage';
import { createCheckoutSession, getEntitlements } from '../../../api/monetizationApi';
import { BILLING_KEYS, PRICING } from '../config';
import type { BillingProduct, IBillingProvider, PurchaseResult } from '../types';

const NOT_CONFIGURED =
  'Stripe billing is not configured. Set EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY (client) and StripeSettings on the ' +
  'server (SecretKey, WebhookSecret, Price IDs). See docs/commercial/billing-architecture.md.';

function requireConfigured(): void {
  if (!BILLING_KEYS.stripePublishableKey) throw new Error(NOT_CONFIGURED);
}

function planFor(productId: string): 'monthly' | 'yearly' | null {
  if (productId === PRICING.monthly.productId) return 'monthly';
  if (productId === PRICING.yearly.productId) return 'yearly';
  return null;
}

export const stripeBillingProvider: IBillingProvider = {
  id: 'stripe',

  async getProducts(): Promise<BillingProduct[]> {
    requireConfigured();
    // Display catalog from config; the authoritative localized price is shown on Stripe Checkout.
    return [
      { id: PRICING.monthly.productId, price: PRICING.monthly.price, period: 'month' },
      { id: PRICING.yearly.productId, price: PRICING.yearly.price, period: 'year' },
    ];
  },

  async purchase(productId: string): Promise<PurchaseResult> {
    requireConfigured();
    const plan = planFor(productId);
    if (!plan) return { ok: false, error: 'unknown_product' };
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return { ok: false, error: 'requires_account' };
    try {
      const { url } = await createCheckoutSession(plan, token);
      // Lazy import (native module; keeps it out of the module graph until a real, configured purchase).
      // NOTE (web): a full-page redirect (window.location) is preferable to an in-app browser; the success_url
      // returns to the app, which re-reads entitlement on mount.
      const WebBrowser = await import('expo-web-browser');
      await WebBrowser.openBrowserAsync(url);
      const ent = await getEntitlements(token); // server is authoritative (granted only after the webhook)
      return ent.plan === 'premium'
        ? { ok: true, entitlement: { plan: 'premium', productId, since: new Date().toISOString() } }
        : { ok: false, error: 'pending_verification' };
    } catch {
      return { ok: false, error: 'checkout_failed' };
    }
  },

  async restore(): Promise<PurchaseResult> {
    requireConfigured();
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return { ok: false, error: 'requires_account' };
    try {
      const ent = await getEntitlements(token);
      return ent.plan === 'premium'
        ? { ok: true, entitlement: { plan: 'premium', productId: ent.productId ?? undefined, since: new Date().toISOString() } }
        : { ok: false, error: 'nothing_to_restore' };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  },
};
