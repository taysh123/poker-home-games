/**
 * Bankroll on-device store (v2 — account-scoped, B1). Mirrors `personaStore` /
 * `coachStore` exactly: ONE versioned AsyncStorage file holding an account-keyed
 * `byAccount` map (`accountKeyFor`: `'guest'` or `'acct:<userId>'`), corrupt-payload
 * quarantine (never silent data loss), a migration chain, and PURE mutations
 * (file in → new file out) that are unit-tested without I/O.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { GUEST_ACCOUNT_KEY } from '../../auth/identity';
import {
  BANKROLL_SCHEMA_VERSION,
  DEFAULT_BANKROLL_ID,
  type BankrollAccountData,
  type BankrollFile,
  type BankrollSession,
  type BankrollSettings,
  type CashDetail,
  type TournamentDetail,
  type BankrollGameType,
  type BankrollSource,
} from '../types';

// Exported so the test files reference the literal via this constant rather than duplicating the
// string — follows personaStore's convention specifically. coachStore keeps its STORAGE_KEY
// private and its own tests hardcode the literal instead; the two precedents this module cites
// are not identical on this one point, so this doesn't "mirror both exactly" here.
export const STORAGE_KEY = 'tpoker.bankroll.v1';
const QUARANTINE_PREFIX = 'tpoker.bankroll.quarantine.';
const DEFAULT_CURRENCY = 'ILS';

function emptyAccountData(): BankrollAccountData {
  return { settings: { startingBankrollCents: 0, currency: DEFAULT_CURRENCY }, sessions: [] };
}

export function emptyFile(): BankrollFile {
  return { schemaVersion: BANKROLL_SCHEMA_VERSION, byAccount: {} };
}

/** The account's data, or sensible empty defaults if this account has never written anything. Pure. */
export function accountDataFor(file: BankrollFile, accountKey: string): BankrollAccountData {
  return file.byAccount[accountKey] ?? emptyAccountData();
}

/** New file with the account's data replaced. Pure, non-mutating. */
function withAccountData(file: BankrollFile, accountKey: string, data: BankrollAccountData): BankrollFile {
  return { ...file, byAccount: { ...file.byAccount, [accountKey]: data } };
}

/**
 * Guest→account claim: when a guest signs in, their on-device bankroll history follows them —
 * copied into the account slot IFF the account has none of its own (an account's own data
 * always wins — an account WITH existing bankroll data must NEVER have guest data claimed
 * over it; this is the load-bearing safety property, pinned and revert-tested in
 * bankrollStore.test.ts). The guest copy is retained deliberately: never destroy data during a
 * claim (repo rule), and once signed in the account slot is authoritative anyway. Mirrors
 * `claimGuestPersona` exactly. Pure; returns the SAME reference when nothing changes.
 */
export function claimGuestBankroll(file: BankrollFile, accountKey: string): BankrollFile {
  if (accountKey === GUEST_ACCOUNT_KEY) return file;
  const guest = file.byAccount[GUEST_ACCOUNT_KEY];
  if (!guest) return file;
  if (file.byAccount[accountKey]) return file;
  return withAccountData(file, accountKey, guest);
}

function defensiveSettings(s: Partial<BankrollSettings> | undefined): BankrollSettings {
  return { startingBankrollCents: s?.startingBankrollCents ?? 0, currency: s?.currency ?? DEFAULT_CURRENCY };
}

type V1File = { schemaVersion: 1; settings?: Partial<BankrollSettings>; sessions?: unknown[] };
type V2File = { schemaVersion: 2; byAccount?: Record<string, Partial<BankrollAccountData>> };
type AnyVersionFile = (V1File | V2File) & { schemaVersion: number };

function isValidFile(value: unknown): value is AnyVersionFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; sessions?: unknown; byAccount?: unknown };
  if (f.schemaVersion === 1) return Array.isArray(f.sessions);
  if (f.schemaVersion === 2) return typeof f.byAccount === 'object' && f.byAccount !== null;
  return false;
}

/**
 * Migration dispatcher. v1 (device-global, unscoped) → v2 (account-scoped): the flat blob
 * becomes the GUEST bucket, because existing pre-scoping data has no owner attribution —
 * whoever happens to be signed in when they next open the app claims it via
 * claimGuestBankroll, exactly like a brand-new guest→account claim. This is a recorded
 * product decision (Q2 master plan, B1), not an accident of the migration code: it is the
 * behaviour a returning beta tester would expect (their data "just still being there"), and
 * it is pinned in bankrollStore.test.ts so it stays a decision on record.
 */
function migrateToCurrent(parsed: AnyVersionFile): BankrollFile {
  if (parsed.schemaVersion === 2) {
    const byAccount: Record<string, BankrollAccountData> = {};
    for (const [key, data] of Object.entries((parsed as V2File).byAccount ?? {})) {
      byAccount[key] = {
        settings: defensiveSettings(data?.settings),
        sessions: Array.isArray(data?.sessions) ? (data.sessions as BankrollSession[]) : [],
      };
    }
    return { schemaVersion: BANKROLL_SCHEMA_VERSION, byAccount };
  }
  const v1 = parsed as V1File;
  return {
    schemaVersion: BANKROLL_SCHEMA_VERSION,
    byAccount: {
      [GUEST_ACCOUNT_KEY]: {
        settings: defensiveSettings(v1.settings),
        sessions: Array.isArray(v1.sessions) ? (v1.sessions as BankrollSession[]) : [],
      },
    },
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

/**
 * Add a session for the given account (newest stays in array order by startedAt-agnostic
 * insert; sort at read). `accountKey` is always the SECOND parameter, right after `file` —
 * mirrors `withPersona(file, accountKey, ...)` so every mutator in this module has the same
 * argument shape.
 */
export function addSession(
  file: BankrollFile,
  accountKey: string,
  input: CreateSessionInput,
): { file: BankrollFile; session: BankrollSession } {
  const data = accountDataFor(file, accountKey);
  const now = new Date().toISOString();
  const session = buildSession(input, now, data.settings.currency);
  return {
    file: withAccountData(file, accountKey, { ...data, sessions: [...data.sessions, session] }),
    session,
  };
}

export function updateSession(
  file: BankrollFile,
  accountKey: string,
  id: string,
  updates: Partial<CreateSessionInput>,
): BankrollFile {
  const data = accountDataFor(file, accountKey);
  const now = new Date().toISOString();
  return withAccountData(file, accountKey, {
    ...data,
    sessions: data.sessions.map(s => {
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
  });
}

export function deleteSession(file: BankrollFile, accountKey: string, id: string): BankrollFile {
  const data = accountDataFor(file, accountKey);
  return withAccountData(file, accountKey, { ...data, sessions: data.sessions.filter(s => s.id !== id) });
}

export function updateSettings(
  file: BankrollFile,
  accountKey: string,
  updates: Partial<BankrollSettings>,
): BankrollFile {
  const data = accountDataFor(file, accountKey);
  return withAccountData(file, accountKey, { ...data, settings: { ...data.settings, ...updates } });
}
