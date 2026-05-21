import { useEffect, useRef } from 'react';
import * as Google from 'expo-auth-session/providers/google';

// OAuth client IDs
// - EXPO_CLIENT_ID: for Expo Go (both platforms, proxy auth through auth.expo.io)
// - IOS_CLIENT_ID / ANDROID_CLIENT_ID: for production standalone builds
//   Override with env vars for production; falls back to Expo proxy for Expo Go
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
