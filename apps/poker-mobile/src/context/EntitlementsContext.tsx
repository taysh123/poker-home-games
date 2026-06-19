import React, { createContext, useContext, useMemo } from 'react';
import { usePremium } from '../features/premium/state/PremiumContext';
import {
  AI_CREDIT_POLICY,
  type AiCreditPolicy,
  type PremiumFeatureKey,
  type PremiumTier,
} from '../features/premium/config';

/**
 * Entitlements (V2 monetization seam) — the single read API for "what can this user do".
 * Tier comes from PremiumContext (mock billing now, real IAP later); premium features +
 * the AI credit POLICY come from the premium config (one tunable source). Gate UI with
 * <PremiumGate> or read `useEntitlements()`.
 */
export type EntitlementTier = PremiumTier;
/** Anything gateable: the premium features, or the generic 'premium'. */
export type Entitlement = PremiumFeatureKey | 'premium';

export type EntitlementsContextType = {
  isLoaded: boolean;
  tier: EntitlementTier;
  isPremium: boolean;
  /** True if the current tier unlocks the given premium feature. */
  has: (entitlement: Entitlement) => boolean;
  /** AI Coach credit policy for the current tier (lifetime free / monthly premium). */
  aiCreditPolicy: AiCreditPolicy;
};

const EntitlementsContext = createContext<EntitlementsContextType>({
  isLoaded: false,
  tier: 'free',
  isPremium: false,
  has: () => false,
  aiCreditPolicy: AI_CREDIT_POLICY.free,
});

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { plan, isLoaded } = usePremium();
  const value = useMemo<EntitlementsContextType>(() => {
    const isPremium = plan === 'premium';
    return {
      isLoaded,
      tier: plan,
      isPremium,
      // All premium features unlock together for the premium tier (single tier today).
      has: () => isPremium,
      aiCreditPolicy: AI_CREDIT_POLICY[plan],
    };
  }, [plan, isLoaded]);

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsContextType {
  return useContext(EntitlementsContext);
}
