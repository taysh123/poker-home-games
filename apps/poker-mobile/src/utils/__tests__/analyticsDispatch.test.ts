/**
 * THE pre-consent no-send pin (Wave 0.2, spec decision 5). Unlike screen tests that mock
 * utils/analytics wholesale, this suite runs the REAL analytics module against a mocked
 * posthog-react-native SDK and pins the privacy contract at the SDK boundary:
 *
 *   1. Before the user's explicit Welcome choice, the PostHog client is NEVER constructed and
 *      nothing is captured — track() only buffers in memory.
 *   2. Consent starts the client (EU host), drains the session's buffered funnel events, and
 *      captures subsequent events.
 *   3. Opting out (Profile toggle) stops capture; opting back in resumes it.
 *   4. No EXPO_PUBLIC_POSTHOG_KEY => fail-closed: consent alone never constructs a client.
 *   5. The `analytics` feature flag is a hard kill-switch over everything.
 */
const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockReset = jest.fn();
const mockFlush = jest.fn();
const mockOptOut = jest.fn();
const mockOptIn = jest.fn();
const mockPostHogCtor = jest.fn().mockImplementation(() => ({
  capture: mockCapture,
  identify: mockIdentify,
  reset: mockReset,
  flush: mockFlush,
  optOut: mockOptOut,
  optIn: mockOptIn,
}));
jest.mock('posthog-react-native', () => ({ __esModule: true, default: mockPostHogCtor }));

let mockFlagOn = true;
jest.mock('../../config/features', () => ({
  isFeatureEnabled: (flag: string) => (flag === 'analytics' ? mockFlagOn : true),
}));

// In-memory storage so consent persistence is real behavior, not a mocked no-op.
const mockMem = new Map<string, string>();
jest.mock('../storage', () => ({
  getItemAsync: jest.fn(async (k: string) => mockMem.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => { mockMem.set(k, v); }),
  deleteItemAsync: jest.fn(async (k: string) => { mockMem.delete(k); }),
}));

import {
  track,
  initAnalytics,
  grantAnalyticsConsent,
  setAnalyticsOptOut,
  identifyAnalyticsUser,
  resetAnalyticsIdentity,
  __resetAnalyticsForTests,
} from '../analytics';

describe('analytics dispatch — consent-gated PostHog (real module, mocked SDK)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMem.clear();
    mockFlagOn = true;
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test_key';
    __resetAnalyticsForTests();
  });

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  });

  it('NEVER constructs the SDK or captures before consent — track() only buffers', async () => {
    await initAnalytics();
    track('welcome_shown', { firstRun: true });
    track('study_quiz_completed', { pct: 80 });
    expect(mockPostHogCtor).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('consent starts ONE client on the EU host and drains the buffered funnel events', async () => {
    await initAnalytics();
    track('welcome_shown', { firstRun: true });

    await grantAnalyticsConsent();

    expect(mockPostHogCtor).toHaveBeenCalledTimes(1);
    expect(mockPostHogCtor).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({ host: expect.stringContaining('eu.i.posthog.com') }),
    );
    expect(mockCapture).toHaveBeenCalledWith('welcome_shown', expect.objectContaining({ firstRun: true }));

    track('welcome_guest', { firstRun: true });
    expect(mockCapture).toHaveBeenCalledWith('welcome_guest', expect.objectContaining({ firstRun: true }));
  });

  it('persists consent: a fresh session with the stored marker sends without a new grant', async () => {
    await grantAnalyticsConsent();
    __resetAnalyticsForTests(); // simulate app restart (storage map survives)

    await initAnalytics();
    track('study_quiz_completed', { pct: 50 });
    expect(mockCapture).toHaveBeenCalledWith('study_quiz_completed', expect.objectContaining({ pct: 50 }));
  });

  it('migrates a pre-existing user: hasSeenOnboarding implies the choice was already made', async () => {
    mockMem.set('hasSeenOnboarding', 'true'); // returning user from before the consent marker existed
    await initAnalytics();
    track('study_quiz_completed', { pct: 10 });
    expect(mockPostHogCtor).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith('study_quiz_completed', expect.objectContaining({ pct: 10 }));
  });

  it('opt-out stops capture (and tells the SDK); opt-in resumes', async () => {
    await grantAnalyticsConsent();
    mockCapture.mockClear();

    await setAnalyticsOptOut(true);
    track('study_quiz_completed', { pct: 90 });
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockOptOut).toHaveBeenCalled();

    await setAnalyticsOptOut(false);
    track('study_lesson_completed');
    expect(mockCapture).toHaveBeenCalledWith('study_lesson_completed', expect.anything());
  });

  it('opt-out persists across restarts', async () => {
    await grantAnalyticsConsent();
    await setAnalyticsOptOut(true);
    __resetAnalyticsForTests();

    await initAnalytics();
    track('study_quiz_completed');
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('fail-closed without a PostHog key: consent alone never constructs a client', async () => {
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
    await initAnalytics();
    await grantAnalyticsConsent();
    track('welcome_guest');
    expect(mockPostHogCtor).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('the analytics flag is a hard kill-switch over consent + key', async () => {
    mockFlagOn = false;
    await initAnalytics();
    await grantAnalyticsConsent();
    track('welcome_guest');
    expect(mockPostHogCtor).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('identify/reset reach the SDK only when a client exists', async () => {
    identifyAnalyticsUser('user-1'); // pre-consent → no client, no throw
    expect(mockIdentify).not.toHaveBeenCalled();

    await grantAnalyticsConsent();
    identifyAnalyticsUser('user-1');
    expect(mockIdentify).toHaveBeenCalledWith('user-1');

    resetAnalyticsIdentity();
    expect(mockReset).toHaveBeenCalled();
  });
});
