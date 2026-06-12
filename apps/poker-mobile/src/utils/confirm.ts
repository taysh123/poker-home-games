import { Alert, Platform } from 'react-native';

/**
 * Alert.alert is a no-op on react-native-web — buttons never render and
 * callbacks never fire. These helpers fall back to window.confirm/alert
 * on web so confirmation flows work on every platform.
 */

export function confirmDialog(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  options?: { destructive?: boolean; cancelLabel?: string },
): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: options?.cancelLabel ?? 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: options?.destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

export function infoDialog(title: string, message: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
