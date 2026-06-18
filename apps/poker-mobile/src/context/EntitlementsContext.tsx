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
export type EntitlementTier = 'free' | 'premium';

/** Per-tier monthly AI analysis allowance (account-based quota; server-authoritative later). */
export const TIER_AI_MONTHLY_CREDITS: Record<EntitlementTier, number> = {
  free: 15,
  premium: 300,
};

export type EntitlementsContextType = {
  /** True once entitlement state is resolved (always true today; async/IAP later). */
  isLoaded: boolean;
  /** Current entitlement tier. Default 'free' until a real purchase grants 'premium'. */
  tier: EntitlementTier;
  /** Whether the user holds a given entitlement. */
  has: (entitlement: Entitlement) => boolean;
  /** Convenience for the premium tier. */
  isPremium: boolean;
  /** Monthly AI credit allowance for the current tier. */
  aiMonthlyCredits: number;
};

function makeValue(tier: EntitlementTier): EntitlementsContextType {
  return {
    isLoaded: true,
    tier,
    has: (entitlement) => (entitlement === 'premium' ? tier === 'premium' : false),
    isPremium: tier === 'premium',
    aiMonthlyCredits: TIER_AI_MONTHLY_CREDITS[tier],
  };
}

const EntitlementsContext = createContext<EntitlementsContextType>(makeValue('free'));

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  // Default 'free' tier. Premium-only FEATURES are still open in V2 dev (nothing is
  // gated yet), but the AI quota is real + account-based. Wire this to stored
  // receipts / an IAP SDK later to grant 'premium' — the gates + quotas then enforce
  // with no screen changes.
  const tier: EntitlementTier = 'free';
  const value = useMemo(() => makeValue(tier), [tier]);

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsContextType {
  return useContext(EntitlementsContext);
}
