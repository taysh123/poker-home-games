import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getBillingProvider } from '../providers';
import { FREE_ENTITLEMENT, loadEntitlement, saveEntitlement } from '../data/entitlementStore';
import type { BillingProduct, EntitlementState } from '../types';
import type { PremiumTier } from '../config';

/**
 * Premium/billing state — owns the active entitlement + products and exposes purchase /
 * restore. Backed by the mock billing provider today; a real SDK swaps in behind the
 * provider seam. EntitlementsContext reads `plan` from here to derive tier + AI quota.
 */
type PremiumContextType = {
  plan: PremiumTier;
  isPremium: boolean;
  isLoaded: boolean;
  purchasing: boolean;
  products: BillingProduct[];
  purchase: (productId: string) => Promise<{ ok: boolean; error?: string }>;
  restore: () => Promise<{ ok: boolean }>;
};

const PremiumContext = createContext<PremiumContextType>({
  plan: 'free', isPremium: false, isLoaded: false, purchasing: false, products: [],
  purchase: async () => ({ ok: false }),
  restore: async () => ({ ok: false }),
});

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [entitlement, setEntitlement] = useState<EntitlementState>(FREE_ENTITLEMENT);
  const [products, setProducts] = useState<BillingProduct[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const provider = getBillingProvider();
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
      const res = await getBillingProvider().purchase(productId);
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
    const res = await getBillingProvider().restore();
    if (res.ok && res.entitlement) {
      setEntitlement(res.entitlement);
      await saveEntitlement(res.entitlement);
      return { ok: true };
    }
    // Fall back to whatever is already persisted (already loaded).
    return { ok: entitlement.plan === 'premium' };
  }, [entitlement.plan]);

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
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium(): PremiumContextType {
  return useContext(PremiumContext);
}
