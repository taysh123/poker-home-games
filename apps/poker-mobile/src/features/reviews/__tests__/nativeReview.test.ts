import * as StoreReview from 'expo-store-review';
import { requestNativeReview } from '../nativeReview';

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

const mockAvailable = StoreReview.isAvailableAsync as jest.Mock;
const mockRequest = StoreReview.requestReview as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('requestNativeReview', () => {
  it('requests the review when the store review is available', async () => {
    mockAvailable.mockResolvedValue(true);
    mockRequest.mockResolvedValue(undefined);
    await expect(requestNativeReview()).resolves.toBe(true);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('returns false without requesting when unavailable', async () => {
    mockAvailable.mockResolvedValue(false);
    await expect(requestNativeReview()).resolves.toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('swallows a throwing availability check', async () => {
    mockAvailable.mockRejectedValue(new Error('no store'));
    await expect(requestNativeReview()).resolves.toBe(false);
  });

  it('swallows a throwing requestReview', async () => {
    mockAvailable.mockResolvedValue(true);
    mockRequest.mockRejectedValue(new Error('boom'));
    await expect(requestNativeReview()).resolves.toBe(false);
  });

  it('never rejects, whatever the native layer does', async () => {
    // A rejected promise here would be an unhandled rejection in production; `false` is a
    // completely normal outcome, not an error.
    //
    // NOTE: this must NEVER be called from a button handler. Apple's guidance is explicit that
    // requestReview is not for user-initiated actions, and a tap-driven call is also the
    // review-gating shape Guideline 1.1.7 prohibits. Q1.4b drives it from an app-determined
    // moment plus a timer.
    mockAvailable.mockImplementation(() => { throw new Error('sync throw'); });
    await expect(requestNativeReview()).resolves.toBe(false);
  });
});
