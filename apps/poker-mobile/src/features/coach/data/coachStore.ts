/**
 * Coach store — versioned on-device persistence for usage (cost control) + recent
 * analysis history. Mirrors the local-games / bankroll / study store pattern.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyUsage, type CoachUsage } from '../logic/limits';
import { GUEST_ACCOUNT_KEY } from '../../auth/identity';
import type { CoachAnalysis } from '../types';

const STORAGE_KEY = 'tpoker.coach.v1';
const QUARANTINE_PREFIX = 'tpoker.coach.quarantine.';
const HISTORY_CAP = 30;
export const COACH_FILE_SCHEMA_VERSION = 1 as const;

export interface CoachFile {
  schemaVersion: typeof COACH_FILE_SCHEMA_VERSION;
  /** AI usage tracked PER ACCOUNT (not per device) — keyed by accountKeyFor(user). */
  usageByAccount: Record<string, CoachUsage>;
  history: CoachAnalysis[]; // newest first, capped
}

export function emptyFile(): CoachFile {
  return { schemaVersion: COACH_FILE_SCHEMA_VERSION, usageByAccount: {}, history: [] };
}

function isValidFile(value: unknown): value is { schemaVersion: number; history?: unknown } {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; history?: unknown };
  return f.schemaVersion === 1 && Array.isArray(f.history);
}

function migrateToCurrent(parsed: { usageByAccount?: Record<string, CoachUsage>; usage?: CoachUsage; history?: unknown }): CoachFile {
  // Accept both the new (usageByAccount) and the pre-account (single `usage`) shapes.
  const usageByAccount = parsed.usageByAccount
    ?? (parsed.usage ? { [GUEST_ACCOUNT_KEY]: parsed.usage } : {});
  return {
    schemaVersion: COACH_FILE_SCHEMA_VERSION,
    usageByAccount,
    history: Array.isArray(parsed.history) ? (parsed.history as CoachAnalysis[]) : [],
  };
}

/** Usage for an account key (empty if first time). */
export function getUsage(file: CoachFile, accountKey: string): CoachUsage {
  return file.usageByAccount[accountKey] ?? emptyUsage();
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

/** Pure: set an account's usage + prepend an analysis to history (capped). */
export function recordAnalysis(
  file: CoachFile,
  accountKey: string,
  analysis: CoachAnalysis,
  usage: CoachUsage,
): CoachFile {
  return {
    ...file,
    usageByAccount: { ...file.usageByAccount, [accountKey]: usage },
    history: [analysis, ...file.history].slice(0, HISTORY_CAP),
  };
}
