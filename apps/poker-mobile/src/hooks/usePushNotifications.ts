import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from '../utils/storage';
import { registerDeviceToken, unregisterDeviceToken } from '../api/deviceTokensApi';
import type { RootStackParamList } from '../navigation/AppNavigator';

/**
 * Push notification registration + tap handling. NATIVE ONLY —
 * expo-notifications does not support web; on web every export is a no-op.
 *
 * Delivery caveats (SDK 54): Android works in Expo Go and builds; iOS remote
 * push requires an EAS development/production build (not Expo Go).
 */

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

// Lazy-required so the module never loads on web bundles.
function getNotifications(): typeof import('expo-notifications') | null {
  if (!isNative) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-notifications');
}

const PUSH_TOKEN_KEY = 'expoPushToken';

/** Ask permission, fetch the Expo push token, and register it with the backend. */
export async function registerForPushAsync(accessToken: string): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted && settings.canAskAgain) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return;

    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerDeviceToken(accessToken, pushToken, Platform.OS as 'ios' | 'android');
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken);
  } catch {
    // Push is best-effort; in-app notifications keep working regardless.
  }
}

/** Deactivate this device's token on the backend (called on logout). */
export async function unregisterPushAsync(accessToken: string): Promise<void> {
  if (!isNative) return;
  try {
    const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!pushToken) return;
    await unregisterDeviceToken(accessToken, pushToken);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch {
    // non-critical
  }
}

/** Route a tapped notification. LOCAL reminders carry `data.kind` and never live in the server
 * inbox — game_day lands on the Home TAB explicitly (navigate('MainTabs') alone preserves the
 * last-active tab — critic find C5), other reminder kinds land on MainTabs, and only kind-less
 * (server push) taps go to the inbox, which exists in the authed tree alone — exactly who
 * receives server push. */
function routeNotificationTap(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  kind: unknown,
): void {
  if (kind === 'game_day') {
    navigation.navigate('MainTabs', { screen: 'Home' });
    return;
  }
  if (typeof kind === 'string') {
    navigation.navigate('MainTabs', undefined);
    return;
  }
  navigation.navigate('Notifications');
}

/** Mount once (inside NavigationContainer): foreground display + tap routing. */
export function usePushNotificationListeners() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const subs = useRef<{ remove: () => void }[]>([]);
  const coldStartHandled = useRef(false);

  useEffect(() => {
    const Notifications = getNotifications();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    subs.current.push(
      Notifications.addNotificationResponseReceivedListener(response => {
        routeNotificationTap(navigation, response.notification.request.content.data?.kind);
      }),
    );

    // Cold start (critic find m6): a tap that LAUNCHES the app is delivered before the listener
    // exists. Route the game-day kind only — other kinds keep their normal launch behavior.
    if (!coldStartHandled.current) {
      coldStartHandled.current = true;
      (async () => {
        try {
          const last = await Notifications.getLastNotificationResponseAsync?.();
          const kind = last?.notification.request.content.data?.kind;
          if (kind === 'game_day') navigation.navigate('MainTabs', { screen: 'Home' });
        } catch {
          // best-effort
        }
      })();
    }

    return () => {
      subs.current.forEach(s => s.remove());
      subs.current = [];
    };
  }, [navigation]);
}
