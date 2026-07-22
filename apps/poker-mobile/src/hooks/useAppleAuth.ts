import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

/**
 * Sign in with Apple (App Store Guideline 4.8 — offering Google sign-in on iOS requires an
 * equivalent Apple option). Mirrors useGoogleAuth's shape: { prompt, available } + a result
 * callback. iOS-only; `available` stays false everywhere else (and in browsers/Expo Go when the
 * capability is missing), so callers can hide the button entirely.
 *
 * Nonce contract: ONE random value per attempt goes BOTH to signInAsync (expo-apple-authentication
 * forwards it verbatim, so Apple embeds it as the identity token's `nonce` claim) AND to the caller,
 * which sends it with the token to POST /api/auth/apple-login — AppleAuthService compares the claim
 * verbatim, binding each token to this attempt (replay guard).
 */
export type AppleAuthResult =
  | { type: 'success'; identityToken: string; nonce: string }
  | { type: 'cancel' }
  | { type: 'error'; message: string };

export function useAppleAuth(onResult: (result: AppleAuthResult) => void) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let mounted = true;
    AppleAuthentication.isAvailableAsync()
      .then(ok => { if (mounted) setAvailable(ok); })
      .catch(() => {}); // stays false — button simply doesn't render
    return () => { mounted = false; };
  }, []);

  const prompt = useCallback(async () => {
    const nonce = Crypto.randomUUID();
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });
      if (!credential.identityToken) {
        onResult({ type: 'error', message: 'Apple sign-in failed. Please try again.' });
        return;
      }
      onResult({ type: 'success', identityToken: credential.identityToken, nonce });
    } catch (e) {
      if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        onResult({ type: 'cancel' });
        return;
      }
      onResult({ type: 'error', message: 'Apple sign-in failed. Please try again.' });
    }
  }, [onResult]);

  return { prompt, available };
}
