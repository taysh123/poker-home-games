/**
 * Bankroll on-device store. Mirrors src/local/localGamesStore.ts: a single versioned
 * AsyncStorage file, corrupt-payload quarantine (never silent data loss), a migration
 * chain, and PURE mutations (file in → new file out) that are unit-tested without I/O.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  BANKROLL_SCHEMA_VERSION,
  DEFAULT_BANKROLL_ID,
  type BankrollFile,
  type BankrollSession,
  type BankrollSettings,
  type CashDetail,
  type TournamentDetail,
  type BankrollGameType,
  type BankrollSource,
} from '../types';

const STORAGE_KEY = 'tpoker.bankroll.v1';
const QUARANTINE_PREFIX = 'tpoker.bankroll.quarantine.';
const DEFAULT_CURRENCY = 'ILS';

export function emptyFile(): BankrollFile {
  return {
    schemaVersion: BANKROLL_SCHEMA_VERSION,
    settings: { startingBankrollCents: 0, currency: DEFAULT_CURRENCY },
    sessions: [],
  };
}

type AnyVersionFile = { schemaVersion: number; sessions: unknown[]; settings?: unknown };

function isValidFile(value: unknown): value is AnyVersionFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; sessions?: unknown };
  return f.schemaVersion === 1 && Array.isArray(f.sessions);
}

/** Migration dispatcher. Identity at v1; future versions chain here (see localGamesStore). */
function migrateToCurrent(parsed: AnyVersionFile): BankrollFile {
  const working = parsed as BankrollFile;
  // Defensive defaults so older/partial payloads never crash analytics.
  return {
    schemaVersion: BANKROLL_SCHEMA_VERSION,
    settings: {
      startingBankrollCents: working.settings?.startingBankrollCents ?? 0,
      currency: working.settings?.currency ?? DEFAULT_CURRENCY,
    },
    sessions: working.sessions ?? [],
  };
}

export async function loadFile(): Promise<BankrollFile> {
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
    // Quarantine the unreadable payload (timestamped) rather than destroy it.
    try {
      await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}`, raw);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      /* best-effort */
    }
    return emptyFile();
  }
}

export async function saveFile(file: BankrollFile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(file));
}

export interface CreateSessionInput {
  /** Optional; defaults to DEFAULT_BANKROLL_ID. Reserved for future multi-bankroll. */
  bankrollId?: string;
  gameType: BankrollGameType;
  source: BankrollSource;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  venue?: string;
  feesCents?: number;
  notes?: string;
  tags?: string[];
  currency?: string;
  cash?: CashDetail;
  tournament?: TournamentDetail;
}

function buildSession(input: CreateSessionInput, now: string, currency: string): BankrollSession {
  return {
    id: Crypto.randomUUID(),
    bankrollId: input.bankrollId ?? DEFAULT_BANKROLL_ID,
    gameType: input.gameType,
    source: input.source,
    currency: input.currency ?? currency,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationMinutes: input.durationMinutes,
    venue: input.venue,
    feesCents: input.feesCents ?? 0,
    notes: input.notes,
    tags: input.tags ?? [],
    cash: input.gameType === 'cash' ? input.cash : undefined,
    tournament: input.gameType === 'tournament' ? input.tournament : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

/** Add a session (newest stays in array order by startedAt-agnostic insert; sort at read). */
export function addSession(
  file: BankrollFile,
  input: CreateSessionInput,
): { file: BankrollFile; session: BankrollSession } {
  const now = new Date().toISOString();
  const session = buildSession(input, now, file.settings.currency);
  return { file: { ...file, sessions: [...file.sessions, session] }, session };
}

export function updateSession(
  file: BankrollFile,
  id: string,
  updates: Partial<CreateSessionInput>,
): BankrollFile {
  const now = new Date().toISOString();
  return {
    ...file,
    sessions: file.sessions.map(s => {
      if (s.id !== id) return s;
      const gameType = updates.gameType ?? s.gameType;
      return {
        ...s,
        ...updates,
        gameType,
        // Keep the detail object consistent with the (possibly changed) game type.
        cash: gameType === 'cash' ? (updates.cash ?? s.cash) : undefined,
        tournament: gameType === 'tournament' ? (updates.tournament ?? s.tournament) : undefined,
        tags: updates.tags ?? s.tags,
        updatedAt: now,
      };
    }),
  };
}

export function deleteSession(file: BankrollFile, id: string): BankrollFile {
  return { ...file, sessions: file.sessions.filter(s => s.id !== id) };
}

export function updateSettings(file: BankrollFile, updates: Partial<BankrollSettings>): BankrollFile {
  return { ...file, settings: { ...file.settings, ...updates } };
}
