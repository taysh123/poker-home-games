import type { LocalGame, LocalGamesFile } from '../types';

/**
 * Cloud Sync service — orchestration over the pure merge core + the S7a backend.
 * The feature flag is mocked LIVE here so the network paths can be exercised; the
 * real flag stays comingSoon (see cloudSyncService.gate.test.ts for that path).
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('../../api/apiClient', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock('../../utils/storage', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock('../../features/premium/config', () => {
  const actual = jest.requireActual('../../features/premium/config');
  return { ...actual, isFeatureLive: (k: string) => k === 'cloud_sync' };
});

import apiClient from '../../api/apiClient';
import * as store from '../localGamesStore';
import { backupNow, restore } from '../cloudSyncService';

const mc = apiClient as unknown as { get: jest.Mock; put: jest.Mock };

const game = (id: string, updatedAt: string, over: Partial<LocalGame> = {}): LocalGame => ({
  id, schemaVersion: 4, name: id, status: 'Finished',
  createdAt: '2026-06-01T00:00:00.000Z', updatedAt, players: [], txns: [], ...over,
});
const file = (games: LocalGame[]): LocalGamesFile => ({ schemaVersion: 4, games });
const ids = (f: LocalGamesFile) => f.games.map(g => g.id).sort();

let saved: LocalGamesFile[] = [];
beforeEach(() => {
  jest.clearAllMocks();
  saved = [];
  jest.spyOn(store, 'saveFile').mockImplementation(async f => { saved.push(f); });
});
afterEach(() => jest.restoreAllMocks());

const conflict = () => Object.assign(new Error('stale'), { response: { status: 409 } });

describe('backupNow', () => {
  it('204 (empty cloud) → PUTs local with no baseVersion and records lastBackupAt', async () => {
    jest.spyOn(store, 'loadFile').mockResolvedValue(file([game('L', '2026-06-10T00:00:00.000Z')]));
    mc.get.mockResolvedValue({ status: 204, data: '' });
    mc.put.mockResolvedValue({ data: { version: 1, updatedAt: '2026-06-29T00:00:00.000Z' } });

    const res = await backupNow('tok');

    expect(mc.put).toHaveBeenCalledTimes(1);
    const body = mc.put.mock.calls[0][1];
    expect(body.baseVersion).toBeUndefined();
    expect(JSON.parse(body.payload).games.map((g: LocalGame) => g.id)).toEqual(['L']);
    expect(ids(saved[saved.length - 1])).toEqual(['L']); // saved locally too
    expect(res.lastBackupAt).toBe('2026-06-29T00:00:00.000Z');
  });

  it('folds the cloud copy into local before PUT (no loss) and sends the cloud baseVersion', async () => {
    jest.spyOn(store, 'loadFile').mockResolvedValue(file([game('L', '2026-06-10T00:00:00.000Z')]));
    mc.get.mockResolvedValue({
      status: 200,
      data: { payload: JSON.stringify(file([game('C', '2026-06-09T00:00:00.000Z')])), version: 7 },
    });
    mc.put.mockResolvedValue({ data: { version: 8, updatedAt: '2026-06-29T01:00:00.000Z' } });

    await backupNow('tok');

    const body = mc.put.mock.calls[0][1];
    expect(body.baseVersion).toBe(7);
    expect(JSON.parse(body.payload).games.map((g: LocalGame) => g.id).sort()).toEqual(['C', 'L']);
    expect(ids(saved[saved.length - 1])).toEqual(['C', 'L']);
  });

  it('on 409 re-GETs, re-merges and retries — final PUT carries the fresh version and ALL ids', async () => {
    jest.spyOn(store, 'loadFile').mockResolvedValue(file([game('L', '2026-06-10T00:00:00.000Z')]));
    mc.get
      .mockResolvedValueOnce({ status: 200, data: { payload: JSON.stringify(file([game('C1', '2026-06-08T00:00:00.000Z')])), version: 1 } })
      .mockResolvedValueOnce({ status: 200, data: { payload: JSON.stringify(file([game('C1', '2026-06-08T00:00:00.000Z'), game('C2', '2026-06-09T00:00:00.000Z')])), version: 2 } });
    mc.put
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce({ data: { version: 3, updatedAt: '2026-06-29T02:00:00.000Z' } });

    const res = await backupNow('tok');

    expect(mc.get).toHaveBeenCalledTimes(2);
    expect(mc.put).toHaveBeenCalledTimes(2);
    const finalBody = mc.put.mock.calls[1][1];
    expect(finalBody.baseVersion).toBe(2);
    expect(JSON.parse(finalBody.payload).games.map((g: LocalGame) => g.id).sort()).toEqual(['C1', 'C2', 'L']);
    expect(res.lastBackupAt).toBe('2026-06-29T02:00:00.000Z');
  });

  it('gives up with a conflict error after exhausting bounded retries', async () => {
    jest.spyOn(store, 'loadFile').mockResolvedValue(file([game('L', '2026-06-10T00:00:00.000Z')]));
    mc.get.mockResolvedValue({ status: 204, data: '' });
    mc.put.mockRejectedValue(conflict());

    await expect(backupNow('tok')).rejects.toMatchObject({ reason: 'conflict' });
    expect(mc.put).toHaveBeenCalledTimes(3); // bounded
  });

  it('maps an unexpected PUT failure to unavailable (fail-closed)', async () => {
    jest.spyOn(store, 'loadFile').mockResolvedValue(file([game('L', '2026-06-10T00:00:00.000Z')]));
    mc.get.mockResolvedValue({ status: 204, data: '' });
    mc.put.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 500 } }));

    await expect(backupNow('tok')).rejects.toMatchObject({ reason: 'unavailable' });
  });
});

describe('restore', () => {
  it('folds cloud into local and saves without losing local (no PUT)', async () => {
    jest.spyOn(store, 'loadFile').mockResolvedValue(file([game('L', '2026-06-10T00:00:00.000Z')]));
    mc.get.mockResolvedValue({
      status: 200,
      data: { payload: JSON.stringify(file([game('C', '2026-06-09T00:00:00.000Z')])), version: 4 },
    });

    const res = await restore('tok');

    expect(mc.put).not.toHaveBeenCalled();
    expect(ids(saved[saved.length - 1])).toEqual(['C', 'L']);
    expect(res.games).toBe(2);
  });
});
