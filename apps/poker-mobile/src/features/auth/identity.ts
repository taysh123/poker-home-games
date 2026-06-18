/**
 * V2 identity & auth-method configuration (security foundation).
 *
 * The platform uses TRUSTED, VERIFIED sign-in (Google + Apple) — no anonymous abuse, no
 * disposable-email signups. This module is the seam the UI and the AI-credit system read
 * from; the actual session lives in `context/AuthContext.tsx` (JWT + refresh) and the
 * backend validates provider tokens. No backend work here — just the model + the
 * per-account key that anchors account-based AI quotas.
 */
import type { AuthUser } from '../../api/authApi';

export type AuthMethod = 'google' | 'apple' | 'email';

export interface AuthConfig {
  /** Methods the sign-in UI may offer. */
  allowedMethods: AuthMethod[];
  /** Emphasized / shown first — trusted verified providers. */
  preferredMethods: AuthMethod[];
  /** Open email self-registration. V2 = false (no public account creation). */
  allowEmailSignup: boolean;
  /** If email is ever used, it must be verified (magic-link / OTP) before activation. */
  requireVerifiedEmail: boolean;
}

export const AUTH_CONFIG: AuthConfig = {
  allowedMethods: ['google', 'apple', 'email'],
  preferredMethods: ['google', 'apple'],
  allowEmailSignup: false,   // hardened: no arbitrary self-registration in V2
  requireVerifiedEmail: true,
};

/** Stable guest key — one device scope; AI trial credit is device-bound for guests. */
export const GUEST_ACCOUNT_KEY = 'guest';

/**
 * The key that scopes account-based usage (AI credits, etc.). Tied to the verified
 * account identity when signed in, so reinstalling or multi-device can't farm free
 * credits; falls back to a single device-guest scope when signed out.
 */
export function accountKeyFor(user: Pick<AuthUser, 'userId'> | null | undefined): string {
  return user?.userId ? `acct:${user.userId}` : GUEST_ACCOUNT_KEY;
}

export function isSignedIn(user: Pick<AuthUser, 'userId'> | null | undefined): boolean {
  return !!user?.userId;
}
