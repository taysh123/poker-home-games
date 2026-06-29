/**
 * Pure resolver tests — no mocking, no Platform, no env vars.
 * resolveActiveBillingProviderId is a PURE function: web + paddleClientToken → 'paddle';
 * web + no token → 'mock' (fail-closed, never a live charge while unconfigured);
 * native + revenueCatApiKey → 'revenuecat'; native + no key → 'mock'.
 */
import { resolveActiveBillingProviderId } from '../providers';

describe('resolveActiveBillingProviderId — Paddle edition (fail-closed)', () => {
  describe('web platform', () => {
    it('selects paddle when the client token is present', () => {
      expect(resolveActiveBillingProviderId('web', 'test_abc123paddletoken')).toBe('paddle');
    });

    it('falls back to mock when token is empty (fail-closed — no live charge unconfigured)', () => {
      expect(resolveActiveBillingProviderId('web', '')).toBe('mock');
    });

    it('ignores the revenueCatApiKey on web (Paddle is the web provider)', () => {
      // Even with a RevenueCat key present, web always uses Paddle (when configured) or mock.
      expect(resolveActiveBillingProviderId('web', 'test_paddle', 'rc_key')).toBe('paddle');
      expect(resolveActiveBillingProviderId('web', '', 'rc_key')).toBe('mock');
    });
  });

  describe('native platforms (ios / android)', () => {
    it('selects revenuecat when the revenueCatApiKey is present', () => {
      expect(resolveActiveBillingProviderId('ios', '', 'appl_rc_key_abc')).toBe('revenuecat');
      expect(resolveActiveBillingProviderId('android', '', 'appl_rc_key_abc')).toBe('revenuecat');
    });

    it('falls back to mock when revenueCatApiKey is absent (fail-closed)', () => {
      expect(resolveActiveBillingProviderId('ios', '')).toBe('mock');
      expect(resolveActiveBillingProviderId('android', '')).toBe('mock');
    });

    it('ignores paddleClientToken on native (Paddle is web-only)', () => {
      // A Paddle token must not activate Paddle on native — it always falls through to RC / mock.
      expect(resolveActiveBillingProviderId('ios', 'test_paddle', '')).toBe('mock');
      expect(resolveActiveBillingProviderId('android', 'test_paddle', 'rc_key')).toBe('revenuecat');
    });
  });

  describe('unknown / unusual platform strings', () => {
    it('treats any non-web OS as native (falls back to revenuecat or mock)', () => {
      expect(resolveActiveBillingProviderId('macos', '', 'rc_key')).toBe('revenuecat');
      expect(resolveActiveBillingProviderId('windows', '', '')).toBe('mock');
    });
  });
});
