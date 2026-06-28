/**
 * Paddle Billing provider — WEB subscription checkout via Paddle.js overlay.
 *
 * KEY-GATED + FAIL-CLOSED. When EXPO_PUBLIC_PADDLE_CLIENT_TOKEN is empty (the default),
 * `purchase()` returns { ok: false, error: 'not_configured' } — never a live charge while
 * unconfigured, and the mock provider stays active (via resolveActiveBillingProviderId).
 *
 * On NATIVE platforms, returns { ok: false, error: 'unsupported_platform' } — Paddle Billing
 * is web-only; native uses RevenueCat / IAP (see revenueCatBillingProvider.ts).
 *
 * Web flow:
 *  1. Server creates a Paddle transaction → returns { url, transactionId? }.
 *  2. Client dynamically injects Paddle.js (CDN), initialises, opens the OVERLAY checkout.
 *  3. Resolves { ok: false, error: 'pending_verification' } immediately — the overlay is open
 *     but the grant happens server-side ONLY after a Paddle webhook (subscription.created /
 *     transaction.completed) verifies payment. The fast path for instant-unlock is the
 *     success-redirect → PremiumContext.verifyPendingCheckout(transactionId).
 *
 * PADDLE-VERIFY (sandbox): every Paddle.js API call is annotated with this tag.
 * Confirm each against a real sandbox session before shipping.
 * See docs/release/paddle-billing-research.md §⚠ VERIFY.
 */
import { Platform } from 'react-native';
import * as SecureStore from '../../../utils/storage';
import { createCheckoutSession, getEntitlements } from '../../../api/monetizationApi';
import { BILLING_KEYS, PRICING } from '../config';
import type { BillingProduct, IBillingProvider, PurchaseResult } from '../types';

// ---------------------------------------------------------------------------
// Paddle.js global type (CDN-loaded — no npm package).
// PADDLE-VERIFY (sandbox): confirm method signatures against live Paddle.js v2 API.
// ---------------------------------------------------------------------------
interface PaddleEnvironmentApi {
  /** PADDLE-VERIFY (sandbox): call set('sandbox') BEFORE Initialize; omit (do NOT call) for production. */
  set(env: 'sandbox' | 'production'): void;
}

interface PaddleCheckoutApi {
  /** PADDLE-VERIFY (sandbox): Checkout.open({ transactionId }) is synchronous (no Promise). */
  open(options: {
    transactionId?: string;
    settings?: {
      displayMode?: 'overlay' | 'inline';
      theme?: 'dark' | 'light';
      locale?: string;
      successUrl?: string;
    };
  }): void;
}

interface PaddleStatic {
  Environment: PaddleEnvironmentApi;
  /** PADDLE-VERIFY (sandbox): Initialize (capital I) — not initialize. */
  Initialize(options: { token: string }): void;
  Checkout: PaddleCheckoutApi;
}

// Use globalThis to access web APIs — avoids DOM lib conflicts (mirrors existing code pattern).
type WebGlobal = { Paddle?: PaddleStatic };

/** PADDLE-VERIFY (sandbox): confirm CDN URL for Paddle.js v2. */
const PADDLE_CDN = 'https://cdn.paddle.com/paddle/v2/paddle.js';
const PADDLE_SCRIPT_ID = 'paddle-js-v2';

/**
 * Dynamically inject and load Paddle.js from CDN (web only; kept out of the native bundle).
 * Resolves with the global Paddle object once the script fires onload.
 * PADDLE-VERIFY (sandbox): confirm window.Paddle is populated synchronously after load.
 */
async function loadPaddleScript(): Promise<PaddleStatic> {
  const g = globalThis as unknown as WebGlobal;
  if (g.Paddle) return g.Paddle;

  // We guard with a runtime check — this function is only called when Platform.OS === 'web'.
  const doc = (globalThis as unknown as { document?: Document }).document;
  if (!doc) throw new Error('Paddle.js requires a DOM (web only).');

  return new Promise<PaddleStatic>((resolve, reject) => {
    const existing = doc.getElementById(PADDLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      // Script tag already injected — wait for it to become ready.
      existing.addEventListener('load', () => {
        const paddle = (globalThis as unknown as WebGlobal).Paddle;
        if (paddle) resolve(paddle);
        else reject(new Error('Paddle.js loaded but window.Paddle is undefined'));
      });
      return;
    }
    const script = doc.createElement('script');
    script.id = PADDLE_SCRIPT_ID;
    script.src = PADDLE_CDN; // PADDLE-VERIFY (sandbox): CDN URL serves both sandbox and production
    script.async = true;
    script.onload = () => {
      const paddle = (globalThis as unknown as WebGlobal).Paddle;
      if (paddle) resolve(paddle);
      else reject(new Error('Paddle.js loaded but window.Paddle is undefined'));
    };
    script.onerror = () => reject(new Error('Failed to load Paddle.js from CDN'));
    doc.head.appendChild(script);
  });
}

/**
 * Extract ?_ptxn=<transactionId> from a Paddle checkout URL.
 * PADDLE-VERIFY (sandbox): confirm query param key is '_ptxn' per docs §1 Option B.
 * URL shape: https://<default-payment-link>?_ptxn=txn_01h0j589qt1nee24210teqtz57
 */
function extractTransactionId(url: string): string | undefined {
  try {
    // PADDLE-VERIFY (sandbox): confirm _ptxn is present in the create-transaction response URL
    const parsed = new URL(url);
    return parsed.searchParams.get('_ptxn') ?? undefined;
  } catch {
    return undefined;
  }
}

function planFor(productId: string): 'monthly' | 'yearly' | null {
  if (productId === PRICING.monthly.productId) return 'monthly';
  if (productId === PRICING.yearly.productId) return 'yearly';
  return null;
}

export const paddleBillingProvider: IBillingProvider = {
  id: 'paddle',

  async getProducts(): Promise<BillingProduct[]> {
    // Static catalog from config. Localized prices are shown inside the Paddle overlay at checkout time.
    return [
      { id: PRICING.monthly.productId, price: PRICING.monthly.price, period: 'month' },
      { id: PRICING.yearly.productId,  price: PRICING.yearly.price,  period: 'year' },
    ];
  },

  async purchase(productId: string): Promise<PurchaseResult> {
    // Fail-closed: never charge while unconfigured.
    if (!BILLING_KEYS.paddleClientToken) return { ok: false, error: 'not_configured' };

    // Paddle Billing is web-only; native uses RevenueCat / IAP.
    if (Platform.OS !== 'web') return { ok: false, error: 'unsupported_platform' };

    const plan = planFor(productId);
    if (!plan) return { ok: false, error: 'unknown_product' };

    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return { ok: false, error: 'requires_account' };

    try {
      // Server creates a Paddle transaction (POST /api/billing/checkout) and returns the
      // checkout URL. transactionId may be returned directly or embedded as ?_ptxn in the URL.
      const session = await createCheckoutSession(plan, token);

      // Prefer the transactionId returned directly by the server; fall back to parsing ?_ptxn.
      // PADDLE-VERIFY (sandbox): confirm whether the backend returns transactionId in the JSON body
      // or only via the URL query param. Either path should work once confirmed.
      const transactionId =
        session.transactionId ?? extractTransactionId(session.url);

      if (!transactionId) {
        // No transactionId available — fall back to full-page redirect to the checkout URL.
        // The success-redirect will carry ?_ptxn= so verifyPendingCheckout can be called on return.
        // PADDLE-VERIFY (sandbox): determine whether items-based checkout (no transactionId) is preferable here.
        (globalThis as unknown as { location: { href: string } }).location.href = session.url;
        return { ok: false, error: 'pending_verification' };
      }

      // Dynamically load Paddle.js (CDN injection — lazy, web-only, kept out of native bundle).
      const Paddle = await loadPaddleScript();

      // Environment MUST be set before Initialize. For production, do NOT call Environment.set.
      // PADDLE-VERIFY (sandbox): confirm 'sandbox' is the exact string literal (not 'test', 'development', etc.)
      if (BILLING_KEYS.paddleEnvironment === 'sandbox') {
        Paddle.Environment.set('sandbox'); // PADDLE-VERIFY (sandbox): omit entirely for production builds
      }

      // Initialize with the client-side token (test_… in sandbox, live_… in production).
      // PADDLE-VERIFY (sandbox): confirm Initialize is idempotent when called more than once (e.g. on re-purchase).
      Paddle.Initialize({ token: BILLING_KEYS.paddleClientToken }); // PADDLE-VERIFY (sandbox): method name 'Initialize' (capital I)

      // Open the overlay checkout using the server-created Paddle transaction.
      // PADDLE-VERIFY (sandbox): confirm Checkout.open({ transactionId }) is synchronous and opens immediately.
      Paddle.Checkout.open({
        transactionId,
        settings: { displayMode: 'overlay', theme: 'dark' }, // PADDLE-VERIFY (sandbox): confirm 'overlay' + 'dark' are valid values
      });

      // The overlay is now open. Purchase completion is async (user completes payment in the overlay).
      // Premium is granted ONLY after the Paddle webhook verifies payment on the backend.
      // Instant-unlock fast path: on overlay close/success, caller should invoke
      // PremiumContext.verifyPendingCheckout(transactionId) → POST /api/billing/verify-session.
      return { ok: false, error: 'pending_verification' };
    } catch {
      return { ok: false, error: 'checkout_failed' };
    }
  },

  async restore(): Promise<PurchaseResult> {
    if (!BILLING_KEYS.paddleClientToken) return { ok: false, error: 'not_configured' };
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return { ok: false, error: 'requires_account' };
    try {
      // Server is authoritative — re-read the entitlement to restore premium status.
      const ent = await getEntitlements(token);
      return ent.plan === 'premium'
        ? { ok: true, entitlement: { plan: 'premium', productId: ent.productId ?? undefined, since: new Date().toISOString() } }
        : { ok: false, error: 'nothing_to_restore' };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  },
};
