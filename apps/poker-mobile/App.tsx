import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { NavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { ActiveSessionProvider } from './src/context/ActiveSessionContext';
import AppNavigator from './src/navigation/AppNavigator';
import { RootStackParamList } from './src/navigation/AppNavigator';

WebBrowser.maybeCompleteAuthSession();

function extractDeepLink(url: string): { type: 'session' | 'group'; token: string } | null {
  const s = url.match(/(?:tpoker:\/\/join\/session\/|\/join\/session\/)([A-Za-z0-9_-]+)/);
  if (s) return { type: 'session', token: s[1] };
  const g = url.match(/(?:tpoker:\/\/group\/|tpoker:\/\/join\/group\/|\/join\/group\/)([A-Za-z0-9_-]+)/);
  if (g) return { type: 'group', token: g[1] };
  return null;
}

export default function App() {
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

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

  return (
    <AuthProvider>
      <ActiveSessionProvider>
        <StatusBar style="light" />
        <AppNavigator navigationRef={navRef} />
      </ActiveSessionProvider>
    </AuthProvider>
  );
}
