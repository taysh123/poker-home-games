import { mergeGames, mergeFile, liveGames, countLiveGames } from '../cloudSync';
import type { LocalGame, LocalGamesFile } from '../types';

/**
 * Cloud Sync merge — the data-integrity core. These tests PIN the invariants the
 * merge must satisfy so a sync can never lose or cross-contaminate a game.
 * Style mirrors settlements.test.ts: tiny typed factory + behavior-named cases.
 */

const T = (d: string) => `2026-06-${d}T00:00:00.000Z`;

/** Minimal-but-valid LocalGame. `updatedAt` drives last-writer-wins. */
const game = (id: string, updatedAt: string, over: Partial<LocalGame> = {}): LocalGame => ({
  id,
  schemaVersion: 4,
  name: id,
  status: 'Finished',
  createdAt: T('01'),
  updatedAt,
  players: [],
  txns: [],
  ...over,
});

const file = (games: LocalGame[]): LocalGamesFile => ({ schemaVersion: 4, games });
const idSet = (games: LocalGame[]) => games.map(g => g.id).sort();

describe('mergeGames — presence (invariant 1)', () => {
  it('keeps an id present on only one side (local-only AND cloud-only)', () => {
    const out = mergeGames([game('L', T('10'))], [game('C', T('10'))]);
    expect(idSet(out)).toEqual(['C', 'L']);
  });
});

describe('mergeGames — last-writer-wins (invariants 2,3,4)', () => {
  it('id in both: newer LOCAL updatedAt wins, taken wholesale (invariant 2)', () => {
    const local = [game('X', T('12'), { name: 'local-name' })];
    const cloud = [game('X', T('11'), { name: 'cloud-name' })];
    const out = mergeGames(local, cloud);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(local[0]); // exact winning reference (no field-merge)
    expect(out[0].name).toBe('local-name');
  });

  it('id in both: newer CLOUD updatedAt wins, taken wholesale (invariant 3)', () => {
    const local = [game('X', T('11'), { name: 'local-name' })];
    const cloud = [game('X', T('12'), { name: 'cloud-name' })];
    const out = mergeGames(local, cloud);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(cloud[0]);
    expect(out[0].name).toBe('cloud-name');
  });

  it('exact-tie updatedAt prefers LOCAL — deterministic (invariant 4)', () => {
    const ts = T('12');
    const local = [game('X', ts, { name: 'local' })];
    const cloud = [game('X', ts, { name: 'cloud' })];
    expect(mergeGames(local, cloud)[0].name).toBe('local');
  });
});

describe('mergeGames — tombstones (invariants 5,6)', () => {
  it('a NEWER cloud tombstone propagates the deletion (invariant 5)', () => {
    const local = [game('X', T('11'))]; // active (no deletedAt)
    const cloud = [game('X', T('12'), { deletedAt: T('12') })];
    const out = mergeGames(local, cloud);
    expect(out).toHaveLength(1); // tombstone is INCLUDED so the delete travels
    expect(out[0].deletedAt).toBe(T('12'));
    expect(countLiveGames(out)).toBe(0);
  });

  it('a NEWER local edit beats an older cloud tombstone — un-delete by edit (invariant 6)', () => {
    const local = [game('X', T('13'), { name: 'edited' })];
    const cloud = [game('X', T('12'), { deletedAt: T('12') })];
    const out = mergeGames(local, cloud);
    expect(out[0].deletedAt).toBeUndefined();
    expect(out[0].name).toBe('edited');
    expect(countLiveGames(out)).toBe(1);
  });
});

describe('mergeGames — no loss (invariant 7)', () => {
  it('output id-set === union of inputs, with no duplicate ids', () => {
    const local = [game('A', T('05')), game('B', T('06')), game('shared', T('12'))];
    const cloud = [game('C', T('07')), game('shared', T('11'))];
    const out = mergeGames(local, cloud);
    const outIds = out.map(g => g.id);
    expect(new Set(outIds).size).toBe(outIds.length); // no duplicates
    expect(idSet(out)).toEqual(['A', 'B', 'C', 'shared']); // complete union
  });
});

describe('mergeGames — purity / no cross-contamination (invariant 8)', () => {
  it('does not mutate inputs and never field-merges nested data across versions', () => {
    const local = [game('X', T('12'), { name: 'local', players: [{ id: 'p1', name: 'P1' }] })];
    const cloud = [game('X', T('11'), { name: 'cloud', players: [{ id: 'p2', name: 'P2' }] })];
    const localBefore = JSON.parse(JSON.stringify(local));
    const cloudBefore = JSON.parse(JSON.stringify(cloud));

    const out = mergeGames(local, cloud);

    expect(local).toEqual(localBefore); // inputs untouched
    expect(cloud).toEqual(cloudBefore);
    // The winner's nested data comes WHOLESALE from local; nothing from cloud leaks in.
    expect(out[0].players).toEqual([{ id: 'p1', name: 'P1' }]);
  });

  it('merging disjoint sets is just the concatenation (no interaction)', () => {
    const out = mergeGames([game('A', T('05')), game('B', T('05'))], [game('C', T('05')), game('D', T('05'))]);
    expect(idSet(out)).toEqual(['A', 'B', 'C', 'D']);
    expect(out).toHaveLength(4);
  });
});

describe('mergeGames — commutative + idempotent (invariant 9)', () => {
  it('is commutative on the id-set and idempotent under re-merge', () => {
    const A = [game('A', T('12')), game('shared', T('12'))];
    const B = [game('B', T('11')), game('shared', T('11'))];
    const ab = mergeGames(A, B);
    const ba = mergeGames(B, A);
    expect(idSet(ab)).toEqual(idSet(ba));
    // Re-merging B back in cannot change the id-set.
    expect(idSet(mergeGames(ab, B))).toEqual(idSet(ab));
  });
});

describe('mergeFile + selectors', () => {
  it('mergeFile merges .games and pins schemaVersion 4', () => {
    const out = mergeFile(file([game('A', T('05'))]), file([game('B', T('05'))]));
    expect(out.schemaVersion).toBe(4);
    expect(idSet(out.games)).toEqual(['A', 'B']);
  });

  it('liveGames / countLiveGames filter tombstones', () => {
    const games = [game('A', T('05')), game('B', T('05'), { deletedAt: T('06') })];
    expect(liveGames(games).map(g => g.id)).toEqual(['A']);
    expect(countLiveGames(games)).toBe(1);
  });
});
