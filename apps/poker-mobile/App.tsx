import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking, Platform } from 'react-native';
import { initAnalytics } from './src/utils/analytics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { CurrencyProvider } from './src/context/CurrencyContext';
import { ActiveSessionProvider } from './src/context/ActiveSessionContext';
import { LocalGamesProvider } from './src/context/LocalGamesContext';
import { EntitlementsProvider } from './src/context/EntitlementsContext';
import { ContentProvider } from './src/context/ContentContext';
import { PremiumProvider } from './src/features/premium/state/PremiumContext';
import { BankrollProvider } from './src/features/bankroll/state/BankrollContext';
import { StudyProvider } from './src/features/study/state/StudyContext';
import { CoachProvider } from './src/features/coach/state/CoachContext';
import { MasteryProvider } from './src/features/mastery/state/MasteryContext';
import { EngagementProvider } from './src/features/engagement/state/EngagementContext';
import { ReminderScheduler } from './src/hooks/useReminderScheduler';
import AppNavigator from './src/navigation/AppNavigator';
import { RootStackParamList } from './src/navigation/AppNavigator';
import { isFeatureEnabled } from './src/config/features';
import BrandSplash from './src/components/brand/BrandSplash';
import { SplashGateProvider } from './src/components/brand/SplashGate';
import { colors } from './src/theme/colors';

WebBrowser.maybeCompleteAuthSession();

// Make Inter the app-wide default for all Text/TextInput (weight → family mapped).
// Safe at module load — applies once the font files finish loading below.
applyInterDefault();

// Web shell: paint the browser canvas navy at the earliest point our code runs,
// so the moment between HTML load and the first React frame is deep navy instead
// of a white flash. (The exported index.html ships an unstyled <body>.)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.style.backgroundColor = colors.backgroundDeep;
  document.body.style.backgroundColor = colors.backgroundDeep;
}

function extractDeepLink(url: string): { type: 'session' | 'group'; token: string } | null {
  const s = url.match(/(?:tpoker:\/\/join\/session\/|\/join\/session\/)([A-Za-z0-9_-]+)/);
  if (s) return { type: 'session', token: s[1] };
  const g = url.match(/(?:tpoker:\/\/group\/|tpoker:\/\/join\/group\/|\/join\/group\/)([A-Za-z0-9_-]+)/);
  if (g) return { type: 'group', token: g[1] };
  return null;
}

export default function App() {
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  // Branded launch splash (~1.2s, flag `v2Splash` = kill-switch). When off, start already "done".
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

  // Wave 0.2 — consent-gated analytics: loads the persisted Welcome-choice consent and starts
  // PostHog only when the full gate passes (flag + consent + not opted out + build-time key).
  useEffect(() => {
    void initAnalytics();
  }, []);

  // Brief gate while the display font loads; proceed on error (system fallback).
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <CurrencyProvider>
      <AuthProvider>
        <PremiumProvider>
        <EntitlementsProvider>
          <ContentProvider>
          <ActiveSessionProvider>
            <LocalGamesProvider>
              <BankrollProvider>
                <StudyProvider>
                  <MasteryProvider>
                  <CoachProvider>
                    <EngagementProvider>
                      <StatusBar style="light" />
                      <ReminderScheduler />
                      {/* Entry screens hold their entrance until the splash resolves
                          (SplashGate) — otherwise the choreography plays unseen under
                          the opaque overlay and the handoff double-exposes the brand. */}
                      <SplashGateProvider done={splashDone}>
                        <AppNavigator navigationRef={navRef} />
                      </SplashGateProvider>
                      {!splashDone && <BrandSplash onDone={() => setSplashDone(true)} />}
                    </EngagementProvider>
                  </CoachProvider>
                  </MasteryProvider>
                </StudyProvider>
              </BankrollProvider>
            </LocalGamesProvider>
          </ActiveSessionProvider>
          </ContentProvider>
        </EntitlementsProvider>
        </PremiumProvider>
      </AuthProvider>
      </CurrencyProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
