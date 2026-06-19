/**
 * Pure, fail-closed resolution of the effective entitlement tier (B4). The SERVER is authority for
 * a signed-in user; on uncertainty (offline/error ⇒ server=null) we fall back to a last-known
 * cached premium ONLY — we never upgrade to premium without a server (or cache) saying so, and
 * guests are always free. Kept pure so it is unit-testable without rendering the context.
 */
import type { PremiumTier } from './config';
import type { ServerEntitlement } from '../../api/monetizationApi';

export type { ServerEntitlement };

export interface ResolveInput {
  signedIn: boolean;
  /** Latest server entitlement, or null if the server hasn't answered (offline/error). */
  server: ServerEntitlement | null;
  /** Last-known persisted premium flag (offline cache). */
  cachedPremium: boolean;
}

export interface ResolvedEntitlement {
  tier: PremiumTier;
  isPremium: boolean;
}

export function resolveEntitlement({ signedIn, server, cachedPremium }: ResolveInput): ResolvedEntitlement {
  // No anonymous premium — guests are always free.
  if (!signedIn) return { tier: 'free', isPremium: false };

  // Server is authority when present (explicit free downgrade wins over a stale cache).
  if (server) {
    const isPremium = server.plan === 'premium';
    return { tier: isPremium ? 'premium' : 'free', isPremium };
  }

  // Server unreachable: fall back to the last-known cache, fail-closed to free.
  return cachedPremium ? { tier: 'premium', isPremium: true } : { tier: 'free', isPremium: false };
}
