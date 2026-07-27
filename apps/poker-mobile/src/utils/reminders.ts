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

// The funnel is cancelAll-then-schedule against the OS: two overlapping runs interleave (one
// run's cancelAll wiping another's half-scheduled set → duplicated or stranded reminders), so
// calls are SERIALIZED through a promise chain and a generation counter lets the latest call
// win — a queued run that is already superseded skips entirely. Pinned by
// rescheduleSerialization.test.ts.
let rescheduleChain: Promise<void> = Promise.resolve();
let rescheduleGeneration = 0;

/** Cancel all local scheduled reminders + reschedule the currently-eligible set. Best-effort,
 * serialized: concurrent calls run one at a time and only the latest call's set survives. */
export function rescheduleReminders(prefs: ReminderPrefs, signals: ReminderSignals): Promise<void> {
  const generation = ++rescheduleGeneration;
  const run = async () => {
    if (generation !== rescheduleGeneration) return; // superseded while queued — skip entirely
    const N = getNotifications();
    if (!N) return;
    try {
      await N.cancelAllScheduledNotificationsAsync();
      const specs = eligibleReminders(prefs, signals);
      for (const spec of specs) {
        await N.scheduleNotificationAsync({
          // data.kind lets the tap listener route local reminders away from the server inbox.
          content: { title: spec.title, body: spec.body, data: { kind: spec.kind } },
          trigger: spec.fireAtMs != null
            ? ({ type: 'date', date: spec.fireAtMs } as never) // one-shot (game_day)
            : ({ hour: spec.hour, minute: 0, repeats: true } as never), // repeating daily
        });
      }
    } catch {
      // Reminders are best-effort; never throw into the UI.
    }
  };
  rescheduleChain = rescheduleChain.then(run, run);
  return rescheduleChain;
}

export async function cancelAllReminders(): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try { await N.cancelAllScheduledNotificationsAsync(); } catch { /* best-effort */ }
}
