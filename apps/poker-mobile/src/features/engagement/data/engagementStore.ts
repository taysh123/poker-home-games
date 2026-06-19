/**
 * Engagement persistence — versioned + corrupt-data quarantine (mirrors bankroll/study stores).
 * Only stores "already celebrated" markers (seen achievements + last XP).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENGAGEMENT_SCHEMA_VERSION, type EngagementState } from '../types';

const STORAGE_KEY = 'tpoker.engagement.v1';
const QUARANTINE_PREFIX = 'tpoker.engagement.quarantine.';

export function emptyState(): EngagementState {
  return { schemaVersion: ENGAGEMENT_SCHEMA_VERSION, seenAchievements: {}, lastXp: 0, seeded: false };
}

function isValid(value: unknown): value is EngagementState {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; seenAchievements?: unknown };
  return f.schemaVersion === 1 && typeof f.seenAchievements === 'object' && f.seenAchievements !== null;
}

export async function loadState(): Promise<EngagementState> {
  let raw: string | null = null;
  try { raw = await AsyncStorage.getItem(STORAGE_KEY); } catch { return emptyState(); }
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw);
    if (isValid(parsed)) return { ...emptyState(), ...parsed };
    throw new Error('unexpected shape');
  } catch {
    try {
      await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch { /* best-effort */ }
    return emptyState();
  }
}

export async function saveState(state: EngagementState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
