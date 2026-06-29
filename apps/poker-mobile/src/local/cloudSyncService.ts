/**
 * Cloud Sync — service layer (S7b client). Orchestrates the pure merge core
 * (`cloudSync.ts`) with the S7a backend sync API and on-device persistence.
 *
 * Backend (already shipped — do NOT change). Premium-gated, user-scoped:
 *   GET  /api/sync/localGames → { payload, version, updatedAt } | 204 No-Content
 *   PUT  /api/sync/localGames   body { payload, baseVersion? } → { version, updatedAt }
 *                               a stale baseVersion → 409 Conflict
 *   `payload` is opaque to the server: we use the JSON-serialized LocalGamesFile.
 *
 * Integrity guarantees:
 *   - Backup and restore ALWAYS fold the cloud copy into local via the lossless
 *     merge and save it locally BEFORE/while pushing, so a sync can never drop a
 *     local game (worst case, a failed backup leaves local enriched with cloud).
 *   - On 409 (another device wrote first) we re-GET, re-merge, and retry, bounded.
 *
 * Gating: a HARD `cloud_sync`-live flag check — no network at all while the
 * feature is comingSoon (the shipping state). Premium is enforced server-side
 * (the endpoints are premium-gated) and by the UI; this layer fails closed.
 */
import apiClient from '../api/apiClient';
import * as SecureStore from '../utils/storage';
import * as store from './localGamesStore';
import { mergeFile } from './cloudSync';
import { isFeatureLive } from '../features/premium/config';
import type { LocalGamesFile } from './types';

const NAMESPACE = 'localGames';
const LAST_BACKUP_KEY = 'tpoker.cloudSync.localGames.lastBackupAt';
const MAX_PUT_ATTEMPTS = 3;

export type CloudSyncErrorReason =
  | 'not_available'      // feature not live — never hit the network
  | 'requires_account'   // 401: no/expired auth
  | 'requires_premium'   // 402/403: premium-gated
  | 'conflict'           // 409 persisted after bounded retries
  | 'unavailable';       // network / 5xx / unknown — fail closed

/** A denial the UI can render. `reason` maps 1:1 to a sync outcome. */
export class CloudSyncError extends Error {
  reason: CloudSyncErrorReason;
  constructor(reason: CloudSyncErrorReason) {
    super(reason);
    this.reason = reason;
    this.name = 'CloudSyncError';
  }
}

interface SyncGetResponse { payload: string; version: number; updatedAt: string }
interface SyncPutResponse { version: number; updatedAt: string }

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | undefined)?.response?.status;
}

function isConflict(error: unknown): boolean {
  return statusOf(error) === 409;
}

/** Map an HTTP/axios failure to a CloudSyncError. Fail-closed: unknown ⇒ unavailable. */
function mapError(error: unknown): CloudSyncError {
  if (error instanceof CloudSyncError) return error;
  switch (statusOf(error)) {
    case 409: return new CloudSyncError('conflict');
    case 402: return new CloudSyncError('requires_premium');
    case 403: return new CloudSyncError('requires_premium');
    case 401: return new CloudSyncError('requires_account');
    default:  return new CloudSyncError('unavailable');
  }
}

/** HARD gate: the feature must be genuinely live before any network happens. */
export function cloudSyncEnabled(): boolean {
  return isFeatureLive('cloud_sync');
}

/** Timestamp of the last successful backup (server `updatedAt`), or null. */
export async function getLastBackupAt(): Promise<string | null> {
  try { return await SecureStore.getItemAsync(LAST_BACKUP_KEY); } catch { return null; }
}

async function setLastBackupAt(iso: string): Promise<void> {
  try { await SecureStore.setItemAsync(LAST_BACKUP_KEY, iso); } catch { /* best-effort */ }
}

/** GET the cloud copy. Returns a parsed+migrated file (null on 204 No-Content / unusable payload). */
async function getCloud(token: string): Promise<{ file: LocalGamesFile | null; version: number | undefined }> {
  const res = await apiClient.get<SyncGetResponse>(`/api/sync/${NAMESPACE}`, auth(token));
  if (res.status === 204 || !res.data || !res.data.payload) return { file: null, version: undefined };
  return { file: store.parseStoredFile(res.data.payload), version: res.data.version };
}

async function putCloud(token: string, file: LocalGamesFile, baseVersion: number | undefined): Promise<SyncPutResponse> {
  const body = { payload: JSON.stringify(file), baseVersion };
  const { data } = await apiClient.put<SyncPutResponse>(`/api/sync/${NAMESPACE}`, body, auth(token));
  return data;
}

export interface BackupResult { lastBackupAt: string }

/**
 * Back up: GET cloud → merge into local → save locally → PUT the merged file with
 * the cloud's baseVersion. On 409 (another device wrote first) re-GET, re-merge,
 * and retry up to {@link MAX_PUT_ATTEMPTS} times. The merged file is saved locally
 * on every attempt, so the device never loses (and only gains) data.
 */
export async function backupNow(token: string): Promise<BackupResult> {
  if (!cloudSyncEnabled()) throw new CloudSyncError('not_available');

  let working = await store.loadFile();
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_PUT_ATTEMPTS; attempt++) {
    const { file: cloudFile, version } = await getCloud(token);
    const merged = mergeFile(working, cloudFile ?? store.emptyFile());
    await store.saveFile(merged); // local now holds local ∪ cloud — lossless even if the PUT fails
    working = merged;

    try {
      const put = await putCloud(token, merged, version);
      const ts = put.updatedAt ?? new Date().toISOString();
      await setLastBackupAt(ts);
      return { lastBackupAt: ts };
    } catch (error) {
      lastError = error;
      if (isConflict(error) && attempt < MAX_PUT_ATTEMPTS - 1) continue; // re-merge against the newer cloud
      throw mapError(error);
    }
  }
  throw mapError(lastError);
}

export interface RestoreResult { games: number }

/** Restore: GET cloud → merge into local → save locally. Pulls the cloud in without losing local. */
export async function restore(token: string): Promise<RestoreResult> {
  if (!cloudSyncEnabled()) throw new CloudSyncError('not_available');

  const local = await store.loadFile();
  const { file: cloudFile } = await getCloud(token);
  const merged = mergeFile(local, cloudFile ?? store.emptyFile());
  await store.saveFile(merged);
  return { games: merged.games.length };
}
