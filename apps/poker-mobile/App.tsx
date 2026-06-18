import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from '@expo-google-fonts/sora';
import * as WebBrowser from 'expo-web-browser';
import { NavigationContainerRef } from '@react-navigation/native';
import { applyInterDefault } from './src/theme/fonts';
import { AuthProvider } from './src/context/AuthContext';
import { ActiveSessionProvider } from './src/context/ActiveSessionContext';
import { LocalGamesProvider } from './src/context/LocalGamesContext';
import { EntitlementsProvider } from './src/context/EntitlementsContext';
import AppNavigator from './src/navigation/AppNavigator';
import { RootStackParamList } from './src/navigation/AppNavigator';
import { isFeatureEnabled } from './src/config/features';
import BrandSplash from './src/components/brand/BrandSplash';

WebBrowser.maybeCompleteAuthSession();

// Make Inter the app-wide default for all Text/TextInput (weight → family mapped).
// Safe at module load — applies once the font files finish loading below.
applyInterDefault();

function extractDeepLink(url: string): { type: 'session' | 'group'; token: string } | null {
  const s = url.match(/(?:tpoker:\/\/join\/session\/|\/join\/session\/)([A-Za-z0-9_-]+)/);
  if (s) return { type: 'session', token: s[1] };
  const g = url.match(/(?:tpoker:\/\/group\/|tpoker:\/\/join\/group\/|\/join\/group\/)([A-Za-z0-9_-]+)/);
  if (g) return { type: 'group', token: g[1] };
  return null;
}

export default function App() {
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  // Dual-brand launch splash (flag-gated). When off, start already "done".
  const [splashDone, setSplashDone] = useState(!isFeatureEnabled('v2Splash'));
  // Serif display accents (titles + hero numerals). On fontError we proceed —
  // unknown fontFamily falls back to the system font, which is cosmetic only.
  const [fontsLoaded, fontError] = useFonts({
    DMSerifDisplay_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });

  useEffect(() => {
    function handleUrl(url: string) {
      const link = extractDeepLink(url);
      if (!link) return;
      const navigate = () => {
        if (navRef.current?.isReady()) {
          if (link.type === 'session') {
            navRef.current.navigate('JoinSession', { inviteToken: link.token });
          } else {
            navRef.current.navigate('JoinGroup', { inviteToken: link.token });
          }
        } else {
          setTimeout(navigate, 100);
        }
      };
      navigate();
    }

    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // Brief gate while the display font loads; proceed on error (system fallback).
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <EntitlementsProvider>
          <ActiveSessionProvider>
            <LocalGamesProvider>
              <StatusBar style="light" />
              <AppNavigator navigationRef={navRef} />
              {!splashDone && <BrandSplash onDone={() => setSplashDone(true)} />}
            </LocalGamesProvider>
          </ActiveSessionProvider>
        </EntitlementsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
