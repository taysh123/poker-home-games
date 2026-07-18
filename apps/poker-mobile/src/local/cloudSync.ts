/**
 * Cloud Sync — pure merge core (S7b client).
 *
 * The on-device local-games file is synced to the server as an opaque JSON
 * payload. Two devices (or an offline edit + the server copy) can diverge, so we
 * reconcile with a deterministic, data-LOSSLESS merge:
 *
 *   - Union by `id`.
 *   - For an id present on both sides, the record with the newer `updatedAt`
 *     wins and is taken WHOLESALE — never field-merged. (Field-merging two
 *     versions of a game could invent an impossible money state; settlements
 *     must always come from one self-consistent record.) Exact `updatedAt` ties
 *     prefer the LOCAL copy (the device's own state).
 *   - Tombstones (`deletedAt`) are first-class records: a newer tombstone
 *     propagates a deletion; a newer non-deleted edit resurrects the game.
 *   - Every id in `local ∪ cloud` is represented exactly once (no loss, no dup).
 *
 * Pure + deterministic: no `Date.now`, no input mutation. This is the integrity
 * core — see __tests__/cloudSync.test.ts for the invariants it must satisfy.
 */
import type { LocalGame, LocalGamesFile } from './types';

/** The schema version both the local store and synced payloads share. */
export const CLOUD_SYNC_SCHEMA_VERSION = 4 as const;

/** Visible (non-tombstoned) games. Tombstones stay in the FILE but are hidden from selectors. */
export function liveGames(games: LocalGame[]): LocalGame[] {
  return games.filter(g => !g.deletedAt);
}

/** Count of visible (non-tombstoned) games. */
export function countLiveGames(games: LocalGame[]): number {
  let n = 0;
  for (const g of games) if (!g.deletedAt) n++;
  return n;
}

/**
 * Does `candidate` win over `incumbent` under last-writer-wins (ties → `candidate`)?
 * `updatedAt` values are ISO-8601 UTC strings (always `…Z`, fixed width), so a
 * lexicographic compare equals a chronological compare — no Date parsing needed.
 */
function winsOver(candidate: LocalGame, incumbent: LocalGame): boolean {
  return candidate.updatedAt >= incumbent.updatedAt;
}

/**
 * Union two game arrays by `id`, keeping the newer `updatedAt` per id (ties → local).
 * Returns a new array; inputs are never mutated and winning records are reused by
 * reference (wholesale), so nested player/txn data never crosses versions.
 */
export function mergeGames(local: LocalGame[], cloud: LocalGame[]): LocalGame[] {
  const byId = new Map<string, LocalGame>();
  // Seed with cloud first; then fold local in so a tie keeps the local record.
  for (const g of cloud) byId.set(g.id, g);
  for (const g of local) {
    const incumbent = byId.get(g.id);
    if (!incumbent || winsOver(g, incumbent)) byId.set(g.id, g);
  }
  return Array.from(byId.values());
}

/** Merge two whole files (by `.games`), pinning the current schema version. */
export function mergeFile(localFile: LocalGamesFile, cloudFile: LocalGamesFile): LocalGamesFile {
  return {
    schemaVersion: CLOUD_SYNC_SCHEMA_VERSION,
    games: mergeGames(localFile.games, cloudFile.games),
  };
}
