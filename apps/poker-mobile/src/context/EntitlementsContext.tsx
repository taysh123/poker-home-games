import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePremium } from '../features/premium/state/PremiumContext';
import { useAuth } from './AuthContext';
import { isSignedIn } from '../features/auth/identity';
import { resolveEntitlement } from '../features/premium/entitlementResolve';
import { getEntitlements, type ServerEntitlement } from '../api/monetizationApi';
import * as SecureStore from '../utils/storage';
import {
  AI_CREDIT_POLICY,
  SERVER_AUTHORITATIVE,
  type AiCreditPolicy,
  type PremiumFeatureKey,
  type PremiumTier,
} from '../features/premium/config';

/**
 * Entitlements (V2 monetization seam) — the single read API for "what can this user do".
 * B4: when SERVER_AUTHORITATIVE, the tier comes from `GET /api/entitlements` for signed-in users
 * (with the local mock entitlement as a fail-closed offline cache); the AI credit POLICY still
 * comes from config (one tunable source). Gate UI with <PremiumGate> or read `useEntitlements()`.
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
  /** Re-fetch the server entitlement (call after a purchase/restore). No-op in local mode. */
  refresh: () => Promise<void>;
};

const EntitlementsContext = createContext<EntitlementsContextType>({
  isLoaded: false,
  tier: 'free',
  isPremium: false,
  has: () => false,
  aiCreditPolicy: AI_CREDIT_POLICY.free,
  refresh: async () => {},
});

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const { plan, isLoaded: premiumLoaded } = usePremium();
  const { user } = useAuth();
  const signedIn = isSignedIn(user);
  const userId = user?.userId;

  const [server, setServer] = useState<ServerEntitlement | null>(null);
  const [serverLoaded, setServerLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!SERVER_AUTHORITATIVE || !signedIn) {
      setServer(null);
      setServerLoaded(true);
      return;
    }
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) throw new Error('no_token');
      const ent = await getEntitlements(token);
      setServer(ent);
    } catch {
      setServer(null); // fail-closed — resolve falls back to the local cache, never up
    } finally {
      setServerLoaded(true);
    }
  }, [signedIn]);

  useEffect(() => {
    let cancelled = false;
    setServerLoaded(false);
    refresh().finally(() => { if (cancelled) { /* state already guarded by refresh */ } });
    return () => { cancelled = true; };
  }, [refresh, userId]);

  const value = useMemo<EntitlementsContextType>(() => {
    const cachedPremium = plan === 'premium';
    const resolved = SERVER_AUTHORITATIVE
      ? resolveEntitlement({ signedIn, server, cachedPremium })
      : { tier: plan, isPremium: plan === 'premium' };
    // In server mode for a signed-in user, wait for the first server answer before claiming loaded.
    const isLoaded = premiumLoaded && (SERVER_AUTHORITATIVE && signedIn ? serverLoaded : true);
    return {
      isLoaded,
      tier: resolved.tier,
      isPremium: resolved.isPremium,
      // All premium features unlock together for the premium tier (single tier today).
      has: () => resolved.isPremium,
      aiCreditPolicy: AI_CREDIT_POLICY[resolved.tier],
      refresh,
    };
  }, [plan, premiumLoaded, signedIn, server, serverLoaded, refresh]);

  return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements(): EntitlementsContextType {
  return useContext(EntitlementsContext);
}
