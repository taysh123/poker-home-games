/**
 * Cloud Sync gating — the SHIPPING state. The real `cloud_sync` feature is
 * comingSoon (honesty), so the service must do NO network and refuse cleanly.
 * This file deliberately does NOT mock the feature config.
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

import apiClient from '../../api/apiClient';
import { backupNow, restore, cloudSyncEnabled } from '../cloudSyncService';

const mc = apiClient as unknown as { get: jest.Mock; put: jest.Mock };

beforeEach(() => jest.clearAllMocks());

describe('cloud sync gating (cloud_sync is comingSoon)', () => {
  it('cloudSyncEnabled() is false', () => {
    expect(cloudSyncEnabled()).toBe(false);
  });

  it('backupNow makes NO network call and rejects not_available', async () => {
    await expect(backupNow('tok')).rejects.toMatchObject({ reason: 'not_available' });
    expect(mc.get).not.toHaveBeenCalled();
    expect(mc.put).not.toHaveBeenCalled();
  });

  it('restore makes NO network call and rejects not_available', async () => {
    await expect(restore('tok')).rejects.toMatchObject({ reason: 'not_available' });
    expect(mc.get).not.toHaveBeenCalled();
  });
});
