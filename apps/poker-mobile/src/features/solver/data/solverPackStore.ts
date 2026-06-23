/**
 * Imported solver-pack persistence (AsyncStorage). FAIL-CLOSED + quarantine-never-lose, mirroring
 * `local/localGamesStore.ts`: a corrupt store file or an invalid import is copied to a timestamped quarantine
 * key, never silently dropped. Promotion happens ONLY for packs that pass the full import pipeline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { prepareImport } from '../pack/importPack';
import type { SolverPack } from '../pack/types';

const KEY = 'tpoker.solverPacks.v1';
const QUARANTINE_PREFIX = 'tpoker.solverPacks.quarantine.';

interface StoreFile {
  schemaVersion: 1;
  packs: SolverPack[];
}

async function readFile(): Promise<StoreFile> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { schemaVersion: 1, packs: [] };
  try {
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || !Array.isArray(parsed.packs)) throw new Error('bad shape');
    return parsed;
  } catch {
    await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, raw); // quarantine, never lose
    return { schemaVersion: 1, packs: [] };
  }
}

export async function loadPacks(): Promise<SolverPack[]> {
  return (await readFile()).packs;
}

export interface ImportOutcome {
  ok: boolean;
  errors: string[];
  packId?: string;
}

/** Import a raw export → validate → promote (replacing a same-id pack) | quarantine. Fail-closed. */
export async function importAndStore(raw: unknown): Promise<ImportOutcome> {
  const prepared = prepareImport(raw);
  if (!prepared.ok || !prepared.pack) {
    await AsyncStorage.setItem(`${QUARANTINE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, safeStringify(raw));
    return { ok: false, errors: prepared.errors };
  }
  const pack = prepared.pack;
  const file = await readFile();
  const packs = file.packs.filter(p => p.manifest.id !== pack.manifest.id);
  packs.push(pack);
  await AsyncStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1, packs }));
  return { ok: true, errors: [], packId: pack.manifest.id };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}
