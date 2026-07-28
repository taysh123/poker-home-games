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
    // The caller fires this from a button handler. A rejected promise there is an unhandled
    // rejection in production; `false` is a completely normal outcome, not an error.
    mockAvailable.mockImplementation(() => { throw new Error('sync throw'); });
    await expect(requestNativeReview()).resolves.toBe(false);
  });
});
