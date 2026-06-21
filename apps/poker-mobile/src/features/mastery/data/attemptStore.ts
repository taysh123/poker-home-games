/**
 * Mastery attempt store — versioned on-device persistence for per-objective attempt aggregates. Mirrors the
 * local-games / coach / study store pattern (versioned key, quarantine on corrupt, pure mutations).
 *
 * Stores the MATERIALIZED `ObjectiveStat` per objective key (bounded by # objectives, exact) — exactly what
 * the mastery engine consumes — rather than an unbounded attempt log. Honest by construction: a key appears
 * only after a real attempt is recorded for it; nothing is invented.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyAttempt } from '../logic/aggregate';
import type { ObjectiveStat } from '../types';

const STORAGE_KEY = 'tpoker.masteryAttempts.v1';
const QUARANTINE_PREFIX = 'tpoker.masteryAttempts.quarantine.';
export const MASTERY_FILE_SCHEMA_VERSION = 1 as const;

export interface MasteryFile {
  schemaVersion: typeof MASTERY_FILE_SCHEMA_VERSION;
  /** objectiveKey → running ObjectiveStat. Key = LearningObjectiveID or a labeled `cat:<category>` proxy. */
  statsByKey: Record<string, ObjectiveStat>;
}

export function emptyFile(): MasteryFile {
  return { schemaVersion: MASTERY_FILE_SCHEMA_VERSION, statsByKey: {} };
}

function isValidFile(value: unknown): value is { schemaVersion: number; statsByKey?: unknown } {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; statsByKey?: unknown };
  return f.schemaVersion === 1 && typeof f.statsByKey === 'object' && f.statsByKey !== null && !Array.isArray(f.statsByKey);
}

export async function loadFile(): Promise<MasteryFile> {
  let raw: string | null = null;
  try { raw = await AsyncStorage.getItem(STORAGE_KEY); } catch { return emptyFile(); }
  if (!raw) return emptyFile();
  try {
    const parsed = JSON.parse(raw);
    if (isValidFile(parsed)) {
      return { schemaVersion: MASTERY_FILE_SCHEMA_VERSION, statsByKey: (parsed as MasteryFile).statsByKey };
    }
    throw new Error('unexpected shape');
  } catch {
    try {
      await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch { /* best-effort */ }
    return emptyFile();
  }
}

export async function saveFile(file: MasteryFile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

/** Pure: record one graded attempt against an objective key → new file. */
export function recordAttempt(file: MasteryFile, objectiveKey: string, correct: boolean, at: number): MasteryFile {
  return {
    ...file,
    statsByKey: { ...file.statsByKey, [objectiveKey]: applyAttempt(file.statsByKey[objectiveKey], correct, at) },
  };
}
