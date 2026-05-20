import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recentGuestNames';
const MAX = 20;

export async function getRecentGuests(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function recordGuestName(name: string): Promise<void> {
  try {
    const existing = await getRecentGuests();
    const filtered = existing.filter(n => n.toLowerCase() !== name.toLowerCase());
    const updated = [name, ...filtered].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // non-critical
  }
}
