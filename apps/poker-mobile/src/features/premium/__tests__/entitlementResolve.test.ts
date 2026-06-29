/**
 * B4 — server entitlement resolution is fail-closed: the server is authority for signed-in users,
 * with a last-known cache fallback that never UPGRADES on uncertainty (offline/error ⇒ free unless
 * a cached premium exists). Guests are always free.
 */
import { resolveEntitlement, type ServerEntitlement } from '../entitlementResolve';

const premium: ServerEntitlement = { plan: 'premium', status: 'active', productId: 'p', expiresAt: null };
const free: ServerEntitlement = { plan: 'free', status: 'none', productId: null, expiresAt: null };

describe('resolveEntitlement (fail-closed)', () => {
  it('uses the server result for a signed-in user (premium)', () => {
    expect(resolveEntitlement({ signedIn: true, server: premium, cachedPremium: false })).toMatchObject({ tier: 'premium', isPremium: true });
  });

  it('uses the server result for a signed-in user (free) even if a stale cache said premium', () => {
    // Server is authority: an explicit free downgrade wins over a stale premium cache.
    expect(resolveEntitlement({ signedIn: true, server: free, cachedPremium: true })).toMatchObject({ tier: 'free', isPremium: false });
  });

  it('falls back to cached premium when the server is unreachable (server=null)', () => {
    expect(resolveEntitlement({ signedIn: true, server: null, cachedPremium: true })).toMatchObject({ tier: 'premium', isPremium: true });
  });

  it('fails closed to free when offline with no cached premium', () => {
    expect(resolveEntitlement({ signedIn: true, server: null, cachedPremium: false })).toMatchObject({ tier: 'free', isPremium: false });
  });

  it('guests are always free regardless of cache', () => {
    expect(resolveEntitlement({ signedIn: false, server: premium, cachedPremium: true })).toMatchObject({ tier: 'free', isPremium: false });
  });
});
