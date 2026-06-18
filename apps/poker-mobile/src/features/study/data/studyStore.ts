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

function isValidFile(value: unknown): value is StudyFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; progress?: unknown };
  return f.schemaVersion === 1 && typeof f.progress === 'object' && f.progress !== null;
}

function migrateToCurrent(parsed: StudyFile): StudyFile {
  // Identity at v1; future versions chain here. Merge against defaults defensively.
  return {
    schemaVersion: STUDY_SCHEMA_VERSION,
    progress: { ...emptyProgress(), ...parsed.progress },
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
