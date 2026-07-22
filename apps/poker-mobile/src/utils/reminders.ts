/**
 * Local scheduled re-engagement reminders (V2.1 STEP 3.6). NATIVE ONLY — expo-notifications has no
 * web support; every web call is a no-op. Zero backend: all reminders are scheduled on-device.
 * Mirrors the lazy-require pattern in hooks/usePushNotifications.ts so web bundles never load it.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eligibleReminders, type ReminderPrefs, type ReminderSignals } from './reminderLogic';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

function getNotifications(): typeof import('expo-notifications') | null {
  if (!isNative) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('expo-notifications');
}

/** Ask for notification permission (idempotent). Returns whether granted. */
export async function ensureReminderPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  try {
    const settings = await N.getPermissionsAsync();
    let granted = settings.granted;
    if (!granted && settings.canAskAgain) {
      const req = await N.requestPermissionsAsync();
      granted = req.granted;
    }
    return granted;
  } catch {
    return false;
  }
}

const PERMISSION_ASKED_KEY = 'tpoker.reminders.permissionAsked.v1';

/**
 * Contextual ONE-TIME permission ask (Wave 0.3): call after the user's first completed drill —
 * never at onboarding or app start. The OS prompt fires at most once ever (persisted marker);
 * users can still enable reminders later from the preferences screen, which asks explicitly.
 * Returns whether permission is granted by THIS ask (false when skipped/no-op).
 */
export async function requestReminderPermissionOnce(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const asked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
    if (asked) return false;
    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, '1');
    return await ensureReminderPermission();
  } catch {
    return false;
  }
}

/** Cancel all local scheduled reminders + reschedule the currently-eligible set. Best-effort. */
export async function rescheduleReminders(prefs: ReminderPrefs, signals: ReminderSignals): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    const specs = eligibleReminders(prefs, signals);
    for (const spec of specs) {
      await N.scheduleNotificationAsync({
        content: { title: spec.title, body: spec.body },
        trigger: { hour: spec.hour, minute: 0, repeats: true } as never,
      });
    }
  } catch {
    // Reminders are best-effort; never throw into the UI.
  }
}

export async function cancelAllReminders(): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try { await N.cancelAllScheduledNotificationsAsync(); } catch { /* best-effort */ }
}
