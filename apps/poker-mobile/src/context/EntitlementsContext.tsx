import React, { createContext, useContext, useMemo } from 'react';

/**
 * Entitlements abstraction (V2 monetization seam).
 *
 * Everything is UNLOCKED right now — but premium surfaces are wired through this
 * context from day one, so adding a real paywall later (IAP / RevenueCat) means
 * swapping the resolver below, NOT rewriting screens. Gate UI with <PremiumGate>
 * or read `useEntitlements()` directly.
 *
 * Extend `Entitlement` as premium tiers appear (e.g. 'gto_pro', 'coach_pro').
 */
export type Entitlement = 'premium';

const ALL_ENTITLEMENTS: Entitlement[] = ['premium'];

export type EntitlementsContextType = {
  /** True once entitlement state is resolved (always true today; async later). */
  isLoaded: boolean;
  /** Whether the user holds a given entitlement. */
  has: (entitlement: Entitlement) => boolean;
  /** Convenience for the single premium tier. */
  isPremium: boolean;
};

const EntitlementsContext = createContext<EntitlementsContextType>({
  isLoaded: true,
  has: () => true,
  isPremium: true,
});

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  // Phase 0: grant all entitlements (free / open). Later, back this with stored
  // receipts or an IAP SDK and the same gates begin to enforce automatically.
  const granted = useMemo(() => new Set<Entitlement>(ALL_ENTITLEMENTS), []);

  const value = useMemo<EntitlementsContextType>(
    () => ({
      isLoaded: true,
      has: (entitlement: Entitlement) => granted.has(entitlement),
      isPremium: granted.has('premium'),
    }),
    [granted],
  );

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsContextType {
  return useContext(EntitlementsContext);
}
