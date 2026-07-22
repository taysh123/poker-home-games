/**
 * Persona persistence (Wave 1, slice 1.2) — ONE AsyncStorage blob holding an account-scoped map
 * (`byAccount`, keyed by accountKeyFor: 'guest' or 'acct:<userId>'; the coachStore precedent).
 * Corrupt payloads are QUARANTINED to a timestamped key, never silently cleared (repo rule).
 * All map operations are pure; only loadFile/saveFile touch storage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GUEST_ACCOUNT_KEY } from '../../auth/identity';
import type { Persona } from '../types';

export const STORAGE_KEY = 'tpoker.persona.v1';
const QUARANTINE_PREFIX = 'tpoker.persona.quarantine.';

export interface PersonaFile {
  schemaVersion: 1;
  byAccount: Record<string, Persona>;
}

export function emptyFile(): PersonaFile {
  return { schemaVersion: 1, byAccount: {} };
}

function isValidFile(v: unknown): v is PersonaFile {
  if (typeof v !== 'object' || v === null) return false;
  const f = v as Partial<PersonaFile>;
  return f.schemaVersion === 1 && typeof f.byAccount === 'object' && f.byAccount !== null;
}

export async function loadFile(): Promise<PersonaFile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyFile();
    const parsed: unknown = JSON.parse(raw);
    if (isValidFile(parsed)) return parsed;
    await quarantine(raw);
    return emptyFile();
  } catch {
    // JSON.parse threw — preserve the evidence, then start fresh.
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) await quarantine(raw);
    } catch { /* storage unavailable — nothing to preserve */ }
    return emptyFile();
  }
}

async function quarantine(raw: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch { /* best-effort */ }
}

export async function saveFile(file: PersonaFile): Promise<void> {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(file)); } catch { /* best-effort */ }
}

/** The persona stored for an account key, or null. Pure. */
export function personaFor(file: PersonaFile, accountKey: string): Persona | null {
  return file.byAccount[accountKey] ?? null;
}

/** New file with the persona set for the account key. Pure, non-mutating. */
export function withPersona(file: PersonaFile, accountKey: string, persona: Persona): PersonaFile {
  return { ...file, byAccount: { ...file.byAccount, [accountKey]: persona } };
}

/**
 * Guest→account claim: when a guest signs in, their quiz answers follow them — copied into the
 * account slot IFF the account has none (an account's own answers always win). The guest copy is
 * retained deliberately: never destroy data during a claim (repo rule), and once signed in the
 * account slot is authoritative anyway. Pure; returns the SAME reference when nothing changes.
 */
export function claimGuestPersona(file: PersonaFile, accountKey: string): PersonaFile {
  if (accountKey === GUEST_ACCOUNT_KEY) return file;
  const guest = file.byAccount[GUEST_ACCOUNT_KEY];
  if (!guest) return file;
  if (file.byAccount[accountKey]) return file;
  return withPersona(file, accountKey, guest);
}
