/**
 * Study progress store — versioned on-device persistence (mirrors the local-games /
 * bankroll store pattern: quarantine on corruption, migration chain, pure helpers).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STUDY_SCHEMA_VERSION, type StudyFile } from '../types';
import { emptyProgress } from '../logic/progress';

const STORAGE_KEY = 'tpoker.study.v1';
const QUARANTINE_PREFIX = 'tpoker.study.quarantine.';

export function emptyFile(): StudyFile {
  return { schemaVersion: STUDY_SCHEMA_VERSION, progress: emptyProgress() };
}

const SUPPORTED_VERSIONS = new Set([1, 2]);

function isValidFile(value: unknown): value is StudyFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; progress?: unknown };
  return (
    typeof f.schemaVersion === 'number' &&
    SUPPORTED_VERSIONS.has(f.schemaVersion) &&
    typeof f.progress === 'object' &&
    f.progress !== null
  );
}

function migrateToCurrent(parsed: StudyFile): StudyFile {
  // v1 → v2 is purely additive: merging over emptyProgress() fills the new Phase 1 fields
  // (dailyLimitCounters, quizzesCompleted, lessonsCompleted) while preserving existing progress.
  // Always stamp the CURRENT schema version on both the file and the progress.
  return {
    schemaVersion: STUDY_SCHEMA_VERSION,
    progress: { ...emptyProgress(), ...parsed.progress, schemaVersion: STUDY_SCHEMA_VERSION },
  };
}

export async function loadFile(): Promise<StudyFile> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyFile();
  }
  if (!raw) return emptyFile();
  try {
    const parsed = JSON.parse(raw);
    if (isValidFile(parsed)) return migrateToCurrent(parsed);
    throw new Error('unexpected shape');
  } catch {
    try {
      await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      /* best-effort */
    }
    return emptyFile();
  }
}

export async function saveFile(file: StudyFile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}
