import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';

export function lightTap() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function mediumTap() {
  if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function successNotification() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function errorNotification() {
  if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
