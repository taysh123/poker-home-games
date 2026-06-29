/** Persisted reminder preferences (V2.1 STEP 3.6). AsyncStorage, defaulted + merge-safe. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_REMINDER_PREFS, type ReminderPrefs } from './reminderLogic';

const KEY = 'tpoker.reminders.v1';

export async function loadReminderPrefs(): Promise<ReminderPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_REMINDER_PREFS;
    const parsed = JSON.parse(raw) as Partial<ReminderPrefs>;
    return {
      ...DEFAULT_REMINDER_PREFS,
      ...parsed,
      dailyStudy: { ...DEFAULT_REMINDER_PREFS.dailyStudy, ...(parsed.dailyStudy ?? {}) },
    };
  } catch {
    return DEFAULT_REMINDER_PREFS;
  }
}

export async function saveReminderPrefs(prefs: ReminderPrefs): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* best-effort */ }
}
