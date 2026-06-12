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

/** Mount once (inside NavigationContainer): foreground display + tap routing. */
export function usePushNotificationListeners() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const subs = useRef<{ remove: () => void }[]>([]);

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
      Notifications.addNotificationResponseReceivedListener(() => {
        // All current notification types have their detail in the inbox.
        navigation.navigate('Notifications');
      }),
    );

    return () => {
      subs.current.forEach(s => s.remove());
      subs.current = [];
    };
  }, [navigation]);
}
