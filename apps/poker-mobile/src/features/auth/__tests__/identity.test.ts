import { accountKeyFor, isSignedIn, GUEST_ACCOUNT_KEY, AUTH_CONFIG } from '../identity';

describe('accountKeyFor', () => {
  it('scopes to the verified account when signed in', () => {
    expect(accountKeyFor({ userId: 'u-123' })).toBe('acct:u-123');
  });
  it('falls back to a single device-guest scope when signed out', () => {
    expect(accountKeyFor(null)).toBe(GUEST_ACCOUNT_KEY);
    expect(accountKeyFor(undefined)).toBe(GUEST_ACCOUNT_KEY);
    expect(accountKeyFor({ userId: '' })).toBe(GUEST_ACCOUNT_KEY);
  });
  it('isSignedIn reflects a real account id', () => {
    expect(isSignedIn({ userId: 'u-1' })).toBe(true);
    expect(isSignedIn(null)).toBe(false);
  });
});

describe('AUTH_CONFIG (hardened)', () => {
  it('prefers trusted providers and disables open email signup', () => {
    expect(AUTH_CONFIG.preferredMethods).toEqual(['google', 'apple']);
    expect(AUTH_CONFIG.allowEmailSignup).toBe(false);
    expect(AUTH_CONFIG.requireVerifiedEmail).toBe(true);
  });
});
