import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { resolveActiveBillingProvider } from '../providers';
import { FREE_ENTITLEMENT, loadEntitlement, saveEntitlement } from '../data/entitlementStore';
import { verifyCheckoutSession } from '../../../api/monetizationApi';
import * as SecureStore from '../../../utils/storage';
import type { BillingProduct, EntitlementState } from '../types';
import type { PremiumTier } from '../config';

/**
 * Premium/billing state — owns the active entitlement + products and exposes purchase /
 * restore / verifyPendingCheckout. Backed by the key-gated active billing provider
 * (Paddle on web when configured, RevenueCat on native when configured, mock otherwise).
 * EntitlementsContext reads `plan` from here to derive tier + AI quota.
 *
 * Provider selection is fail-closed: when no billing keys are set, the mock provider is
 * active (safe no-op) and production behaviour is unchanged.
 */
type PremiumContextType = {
  plan: PremiumTier;
  isPremium: boolean;
  isLoaded: boolean;
  purchasing: boolean;
  products: BillingProduct[];
  purchase: (productId: string) => Promise<{ ok: boolean; error?: string }>;
  restore: () => Promise<{ ok: boolean }>;
  /**
   * Verify a pending checkout on the web success-redirect (Paddle or Stripe).
   * Calls POST /api/billing/verify-session with the transaction/session id, updates the
   * local entitlement from the server result, and returns { ok: true } when premium is granted.
   * Server is authoritative — the entitlement is only set if the server confirms it.
   */
  verifyPendingCheckout: (transactionId: string) => Promise<{ ok: boolean }>;
};

const PremiumContext = createContext<PremiumContextType>({
  plan: 'free', isPremium: false, isLoaded: false, purchasing: false, products: [],
  purchase: async () => ({ ok: false }),
  restore: async () => ({ ok: false }),
  verifyPendingCheckout: async () => ({ ok: false }),
});

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [entitlement, setEntitlement] = useState<EntitlementState>(FREE_ENTITLEMENT);
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Use the key-gated active provider (Paddle on web, RevenueCat on native, mock when unconfigured).
    const provider = resolveActiveBillingProvider();
    Promise.all([loadEntitlement(), provider.getProducts().catch(() => [])]).then(([ent, prods]) => {
      if (cancelled) return;
      setEntitlement(ent);
      setProducts(prods);
      setIsLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const purchase = useCallback(async (productId: string) => {
    setPurchasing(true);
    try {
      const res = await resolveActiveBillingProvider().purchase(productId);
      if (res.ok && res.entitlement) {
        setEntitlement(res.entitlement);
        await saveEntitlement(res.entitlement);
        return { ok: true };
      }
      return { ok: false, error: res.error };
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restore = useCallback(async () => {
    const res = await resolveActiveBillingProvider().restore();
    if (res.ok && res.entitlement) {
      setEntitlement(res.entitlement);
      await saveEntitlement(res.entitlement);
      return { ok: true };
    }
    // Fall back to whatever is already persisted (already loaded).
    return { ok: entitlement.plan === 'premium' };
  }, [entitlement.plan]);

  /**
   * Verify a pending Paddle (or Stripe) checkout on the web success-redirect.
   * Called with the transaction id (Paddle: txn_… / ?_ptxn= value) or session id (Stripe: cs_…).
   * POSTs to /api/billing/verify-session → server retrieves + verifies the transaction/session,
   * idempotently upserts the same Subscription row the webhook upserts, and returns the
   * authoritative entitlement. Instant unlock fast path — server is the source of truth.
   */
  const verifyPendingCheckout = useCallback(async (transactionId: string) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return { ok: false };
    try {
      const ent = await verifyCheckoutSession(transactionId, token); // server-authoritative
      const next: EntitlementState = ent.plan === 'premium'
        ? { plan: 'premium', productId: ent.productId ?? undefined, since: new Date().toISOString() }
        : FREE_ENTITLEMENT;
      setEntitlement(next);
      await saveEntitlement(next);
      return { ok: ent.plan === 'premium' };
    } catch {
      return { ok: false };
    }
  }, []);

  return (
    <PremiumContext.Provider
      value={{
        plan: entitlement.plan,
        isPremium: entitlement.plan === 'premium',
        isLoaded,
        purchasing,
        products,
        purchase,
        restore,
        verifyPendingCheckout,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium(): PremiumContextType {
  return useContext(PremiumContext);
}
