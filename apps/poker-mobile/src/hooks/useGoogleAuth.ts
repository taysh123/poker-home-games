import { useEffect, useRef } from 'react';
import * as Google from 'expo-auth-session/providers/google';

// OAuth client IDs — these must ALL be listed in the backend's
// GoogleSettings:ClientIds audience allow-list or token validation fails.
// - EXPO_CLIENT_ID: web-type client used as the Expo Go / dev fallback
// - IOS_CLIENT_ID / ANDROID_CLIENT_ID / WEB_CLIENT_ID: per-platform clients,
//   overridable via EXPO_PUBLIC_* env vars (see docs/google-oauth-fix.md)
// Note: expo-auth-session v5+ has no auth.expo.io proxy — flows are direct.
const EXPO_CLIENT_ID    = '12435044751-jdh0dldfhkn2h8hqs3ssegbjflhvcmfi.apps.googleusercontent.com';
const IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
                          ?? '12435044751-jap7j5prc6vm0eh0mj517nv0phrlu8mr.apps.googleusercontent.com';
const WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
                          ?? '12435044751-eruvq9uduc9sk5mietg9eiab2epddsp6.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? EXPO_CLIENT_ID;

type GoogleAuthResult =
  | { type: 'success'; idToken: string }
  | { type: 'error'; message: string }
  | { type: 'cancel' };

function useGoogleAuthNative(onResult: (result: GoogleAuthResult) => void) {
  // Ref keeps the latest callback without triggering the effect to re-run
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; });

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: EXPO_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
  });

  // Dev diagnostic: the EXACT redirect_uri sent to Google. On web this is the page origin; it must be
  // registered VERBATIM in the OAuth client's Authorized redirect URIs (Google matches it character-for-
  // character — scheme/host/port/trailing-slash). A mismatch here is the cause of Error 400 redirect_uri_mismatch.
  useEffect(() => {
    if (__DEV__ && request?.redirectUri) console.log('[google] redirectUri =', request.redirectUri);
  }, [request]);

  useEffect(() => {
    if (!response) return;

    if (response.type === 'success') {
      const idToken = response.params.id_token;
      if (idToken) {
        onResultRef.current({ type: 'success', idToken });
      } else {
        onResultRef.current({ type: 'error', message: 'Google did not return a token.' });
      }
    } else if (response.type === 'error') {
      onResultRef.current({ type: 'error', message: response.error?.message ?? 'Google sign-in failed.' });
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      onResultRef.current({ type: 'cancel' });
    }
  }, [response]);

  return { prompt: () => promptAsync(), ready: !!request };
}

export const useGoogleAuth = useGoogleAuthNative;
