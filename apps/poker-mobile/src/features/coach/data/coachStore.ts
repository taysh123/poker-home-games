/**
 * Coach store — versioned on-device persistence for usage (cost control) + recent
 * analysis history. Mirrors the local-games / bankroll / study store pattern.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyUsage, type CoachUsage } from '../logic/limits';
import type { CoachAnalysis } from '../types';

const STORAGE_KEY = 'tpoker.coach.v1';
const QUARANTINE_PREFIX = 'tpoker.coach.quarantine.';
const HISTORY_CAP = 30;
export const COACH_FILE_SCHEMA_VERSION = 1 as const;

export interface CoachFile {
  schemaVersion: typeof COACH_FILE_SCHEMA_VERSION;
  usage: CoachUsage;
  history: CoachAnalysis[]; // newest first, capped
}

export function emptyFile(): CoachFile {
  return { schemaVersion: COACH_FILE_SCHEMA_VERSION, usage: emptyUsage(), history: [] };
}

function isValidFile(value: unknown): value is CoachFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; usage?: unknown; history?: unknown };
  return f.schemaVersion === 1 && typeof f.usage === 'object' && Array.isArray(f.history);
}

function migrateToCurrent(parsed: CoachFile): CoachFile {
  return {
    schemaVersion: COACH_FILE_SCHEMA_VERSION,
    usage: { ...emptyUsage(), ...parsed.usage },
    history: parsed.history ?? [],
  };
}

export async function loadFile(): Promise<CoachFile> {
  let raw: string | null = null;
  try { raw = await AsyncStorage.getItem(STORAGE_KEY); } catch { return emptyFile(); }
  if (!raw) return emptyFile();
  try {
    const parsed = JSON.parse(raw);
    if (isValidFile(parsed)) return migrateToCurrent(parsed);
    throw new Error('unexpected shape');
  } catch {
    try {
      await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch { /* best-effort */ }
    return emptyFile();
  }
}

export async function saveFile(file: CoachFile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

/** Pure: prepend an analysis to history (capped) and set the new usage. */
export function recordAnalysis(file: CoachFile, analysis: CoachAnalysis, usage: CoachUsage): CoachFile {
  return { ...file, usage, history: [analysis, ...file.history].slice(0, HISTORY_CAP) };
}
