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

function extractInviteToken(url: string): string | null {
  const match = url.match(/(?:tpoker:\/\/join\/|\/join\/)([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    function handleUrl(url: string) {
      const token = extractInviteToken(url);
      if (token) {
        const navigate = () => {
          if (navRef.current?.isReady()) {
            navRef.current.navigate('JoinSession', { inviteToken: token });
          } else {
            setTimeout(navigate, 100);
          }
        };
        navigate();
      }
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
