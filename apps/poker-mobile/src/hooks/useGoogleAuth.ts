import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Only complete the auth session redirect on native — web doesn't use the proxy flow
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

const EXPO_CLIENT_ID = '12435044751-jdh0dldfhkn2h8hqs3ssegbjflhvcmfi.apps.googleusercontent.com';
const IOS_CLIENT_ID  = '12435044751-jap7j5prc6vm0eh0mj517nv0phrlu8mr.apps.googleusercontent.com';
// TODO: add WEB_CLIENT_ID here and pass webClientId when enabling Google auth on web

type GoogleAuthResult =
  | { type: 'success'; idToken: string }
  | { type: 'error'; message: string }
  | { type: 'cancel' };

// Stub returned on web until webClientId is configured
function useGoogleAuthDisabled(_onResult: (result: GoogleAuthResult) => void) {
  return { prompt: () => {}, ready: false as const };
}

function useGoogleAuthNative(onResult: (result: GoogleAuthResult) => void) {
  // Ref keeps the latest callback without triggering the effect to re-run
  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; });

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: EXPO_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
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

export const useGoogleAuth = Platform.OS === 'web' ? useGoogleAuthDisabled : useGoogleAuthNative;
