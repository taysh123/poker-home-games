/**
 * PRIVATE saved spots/bookmarks (on-device, AsyncStorage). Quarantine-never-lose on corrupt payload (mirrors
 * other stores). These are private to the user — the public/shared spot library is a separate, future,
 * flag-gated design (see docs/product/public-spot-library-architecture.md), never auto-shared from here.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedSpot {
  id: string;
  packId?: string;
  rangeId: string;
  rangeLabel: string;
  hand: string;
  note?: string;
  createdAt: string; // ISO
}

const KEY = 'tpoker.solverSavedSpots.v1';
const QUARANTINE_PREFIX = 'tpoker.solverSavedSpots.quarantine.';

async function read(): Promise<SavedSpot[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('bad shape');
    return parsed as SavedSpot[];
  } catch {
    await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, raw);
    return [];
  }
}

export async function loadSavedSpots(): Promise<SavedSpot[]> {
  return read();
}

export async function addSavedSpot(spot: Omit<SavedSpot, 'id' | 'createdAt'>): Promise<SavedSpot[]> {
  const spots = await read();
  const created: SavedSpot = {
    ...spot,
    id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [created, ...spots];
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}

export async function removeSavedSpot(id: string): Promise<SavedSpot[]> {
  const updated = (await read()).filter(s => s.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
}
