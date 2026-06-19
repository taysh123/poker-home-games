/**
 * Entitlement store — versioned on-device persistence of the active plan. Mock purchases
 * write here; real IAP receipts (and ultimately the server) become authoritative later.
 * Mirrors the other V2 stores (quarantine + migration).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENTITLEMENT_SCHEMA_VERSION, type EntitlementState } from '../types';

const STORAGE_KEY = 'tpoker.entitlement.v1';
const QUARANTINE_PREFIX = 'tpoker.entitlement.quarantine.';

interface EntitlementFile {
  schemaVersion: typeof ENTITLEMENT_SCHEMA_VERSION;
  entitlement: EntitlementState;
}

export const FREE_ENTITLEMENT: EntitlementState = { plan: 'free' };

function isValid(value: unknown): value is EntitlementFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; entitlement?: { plan?: unknown } };
  return f.schemaVersion === 1 && !!f.entitlement && (f.entitlement.plan === 'free' || f.entitlement.plan === 'premium');
}

export async function loadEntitlement(): Promise<EntitlementState> {
  let raw: string | null = null;
  try { raw = await AsyncStorage.getItem(STORAGE_KEY); } catch { return FREE_ENTITLEMENT; }
  if (!raw) return FREE_ENTITLEMENT;
  try {
    const parsed = JSON.parse(raw);
    if (isValid(parsed)) return parsed.entitlement;
    throw new Error('bad shape');
  } catch {
    try {
      await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch { /* best-effort */ }
    return FREE_ENTITLEMENT; // fail-closed: unknown => free
  }
}

export async function saveEntitlement(entitlement: EntitlementState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: ENTITLEMENT_SCHEMA_VERSION, entitlement }));
}
