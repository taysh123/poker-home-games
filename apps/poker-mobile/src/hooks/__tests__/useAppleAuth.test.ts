/**
 * Sign in with Apple — hook contract (App Store Guideline 4.8: offering Google sign-in on iOS
 * requires an equivalent Apple option). Mirrors useGoogleAuth's { prompt, ready } + result-callback
 * shape. Nonce contract: ONE random value per attempt is passed BOTH to signInAsync (expo-apple-
 * authentication forwards it verbatim → Apple embeds it as the identity token's `nonce` claim) AND
 * to the caller for the server, where AppleAuthService compares the claim verbatim (replay guard).
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockSignInAsync = jest.fn();
const mockIsAvailableAsync = jest.fn();
jest.mock('expo-apple-authentication', () => ({
  signInAsync: (...args: unknown[]) => mockSignInAsync(...args),
  isAvailableAsync: () => mockIsAvailableAsync(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'nonce-1234',
}));

import { useAppleAuth, type AppleAuthResult } from '../useAppleAuth';

describe('useAppleAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockIsAvailableAsync.mockResolvedValue(true);
  });

  it('is available on iOS when the native API reports available', async () => {
    const { result } = renderHook(() => useAppleAuth(jest.fn()));
    await waitFor(() => expect(result.current.available).toBe(true));
  });

  it('is unavailable on non-iOS platforms (never even asks the native module)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { result } = renderHook(() => useAppleAuth(jest.fn()));
    expect(result.current.available).toBe(false);
    expect(mockIsAvailableAsync).not.toHaveBeenCalled();
  });

  it('is unavailable when the native API reports unavailable', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    const { result } = renderHook(() => useAppleAuth(jest.fn()));
    await waitFor(() => expect(mockIsAvailableAsync).toHaveBeenCalled());
    expect(result.current.available).toBe(false);
  });

  it('success → passes the SAME nonce to signInAsync and to the result (server verifies the claim)', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: 'jwt-abc' });
    const results: AppleAuthResult[] = [];
    const { result } = renderHook(() => useAppleAuth(r => results.push(r)));

    await act(async () => { await result.current.prompt(); });

    expect(mockSignInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: 'nonce-1234', requestedScopes: [0, 1] }),
    );
    expect(results).toEqual([{ type: 'success', identityToken: 'jwt-abc', nonce: 'nonce-1234' }]);
  });

  it('missing identityToken → error result (never calls the server with nothing)', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: null });
    const results: AppleAuthResult[] = [];
    const { result } = renderHook(() => useAppleAuth(r => results.push(r)));

    await act(async () => { await result.current.prompt(); });

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('error');
  });

  it('user cancellation → cancel result (silent, not an error)', async () => {
    mockSignInAsync.mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }));
    const results: AppleAuthResult[] = [];
    const { result } = renderHook(() => useAppleAuth(r => results.push(r)));

    await act(async () => { await result.current.prompt(); });

    expect(results).toEqual([{ type: 'cancel' }]);
  });

  it('native failure → error result with a user-facing message', async () => {
    mockSignInAsync.mockRejectedValue(Object.assign(new Error('boom'), { code: 'ERR_REQUEST_FAILED' }));
    const results: AppleAuthResult[] = [];
    const { result } = renderHook(() => useAppleAuth(r => results.push(r)));

    await act(async () => { await result.current.prompt(); });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ type: 'error', message: expect.any(String) });
  });
});
