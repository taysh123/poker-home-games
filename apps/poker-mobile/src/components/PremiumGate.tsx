import React from 'react';
import { useEntitlements, type Entitlement } from '../context/EntitlementsContext';

type PremiumGateProps = {
  /** Entitlement required to see `children`. Defaults to the 'premium' tier. */
  entitlement?: Entitlement;
  children: React.ReactNode;
  /** Rendered when the entitlement is missing (e.g. an upsell card). */
  fallback?: React.ReactNode;
};

/**
 * Wraps premium content. Today every entitlement is granted, so `children` always
 * render — but the seam is in place so a future paywall enforces with zero screen
 * rewrites: when `useEntitlements().has(...)` starts returning false, `fallback`
 * (or null) shows instead.
 */
export function PremiumGate({ entitlement = 'premium', children, fallback = null }: PremiumGateProps) {
  const { has } = useEntitlements();
  return <>{has(entitlement) ? children : fallback}</>;
}

export default PremiumGate;
