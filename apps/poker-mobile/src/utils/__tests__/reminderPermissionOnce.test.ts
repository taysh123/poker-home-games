/**
 * Contextual permission ask (Wave 0.3): the OS notification prompt fires ONCE, after the user's
 * first completed drill — never at onboarding or app start (permission prompts convert best in
 * context, and re-prompting is hostile). The once-marker persists across sessions.
 */
const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: (...a: unknown[]) => mockGetPermissionsAsync(...a),
  requestPermissionsAsync: (...a: unknown[]) => mockRequestPermissionsAsync(...a),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
}));

const mockMem = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItem: jest.fn(async (k: string, v: string) => { mockMem.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockMem.delete(k); }),
}));

import { requestReminderPermissionOnce } from '../reminders';

describe('requestReminderPermissionOnce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMem.clear();
    mockGetPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('asks the OS exactly once — the second call is a no-op', async () => {
    const first = await requestReminderPermissionOnce();
    expect(first).toBe(true);
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);

    const second = await requestReminderPermissionOnce();
    expect(second).toBe(false);
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1); // still once
  });

  it('the once-marker persists (a later session never re-prompts)', async () => {
    await requestReminderPermissionOnce();
    // mockMem survives — simulating the next app session hitting the same storage.
    await requestReminderPermissionOnce();
    await requestReminderPermissionOnce();
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('already-granted permission: returns true, still consumes the single ask', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: false });
    expect(await requestReminderPermissionOnce()).toBe(true);
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(await requestReminderPermissionOnce()).toBe(false); // marker consumed
  });

  it('denied permission: returns false and never re-prompts on later calls', async () => {
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await requestReminderPermissionOnce()).toBe(false);
    expect(await requestReminderPermissionOnce()).toBe(false);
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
