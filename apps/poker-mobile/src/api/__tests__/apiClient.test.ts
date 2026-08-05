/**
 * The 401 → refresh → retry interceptor, exercised against the REAL axios.
 *
 * Why this exists: the axios CVE bump (T0.4) changes the library this interceptor is built on, and
 * the plan's verification step said to "confirm apiClient tests specifically pass" — there were
 * none. The whole suite passing said nothing about the single highest-risk consumer of the bump.
 *
 * These drive axios itself (a fake `adapter`, not a mocked axios), so they exercise the real
 * interceptor pipeline, the real error shape axios builds for a non-2xx status, and the real
 * `axios.create` instance — which is exactly what a version bump can break.
 *
 * The mutex is the load-bearing part: the backend rotates refresh tokens, so replaying a consumed
 * one returns 400. Before the mutex, concurrent 401s each fired their own refresh and the losers
 * cascaded into forced logouts.
 */
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axios, { AxiosError } from 'axios';

jest.mock('../../utils/storage');

import * as storage from '../../utils/storage';
import apiClient, { registerUnauthenticatedCallback } from '../apiClient';

const getItem = storage.getItemAsync as jest.Mock;
const setItem = storage.setItemAsync as jest.Mock;

/**
 * Settles like a real axios adapter. axios calls `settle()` INSIDE its built-in adapters, not in
 * dispatchRequest, so a custom adapter is responsible for rejecting non-2xx itself — and the
 * interceptor under test only ever sees an error shaped this way (an AxiosError carrying `.response`
 * and `.config`). Getting this wrong makes the whole suite pass vacuously.
 */
function settle(config: AxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  const response = {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: config as never,
  } as AxiosResponse;
  if (status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, String(status),
    config as never, null, response);
}

/** Builds a fake adapter: the first call to each url 401s, later calls succeed. */
function adapterThat401sOnce() {
  const seen = new Map<string, number>();
  return jest.fn(async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    const url = config.url ?? '';
    const n = (seen.get(url) ?? 0) + 1;
    seen.set(url, n);
    return n === 1 ? settle(config, 401, {}) : settle(config, 200, { ok: true });
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  getItem.mockReset();
  setItem.mockReset();
  getItem.mockResolvedValue('refresh-token-1');
  setItem.mockResolvedValue(undefined);
  registerUnauthenticatedCallback(() => {});
});

it('refreshes on a 401 and retries the original request with the new token', async () => {
  const post = jest.spyOn(axios, 'post').mockResolvedValue({
    data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
  } as never);
  const adapter = adapterThat401sOnce();
  apiClient.defaults.adapter = adapter;

  const res = await apiClient.get('/api/sessions');

  expect(res.status).toBe(200);
  expect(post).toHaveBeenCalledTimes(1);
  // The retry carries the refreshed token, not the stale one.
  const retry = adapter.mock.calls[1][0];
  expect(retry.headers?.['Authorization']).toBe('Bearer new-access');
  // Both halves of the rotated pair are persisted — dropping the refresh token is what
  // previously produced a logout on the NEXT 401.
  expect(setItem).toHaveBeenCalledWith('accessToken', 'new-access');
  expect(setItem).toHaveBeenCalledWith('refreshToken', 'new-refresh');
});

it('runs only ONE refresh for concurrent 401s (the rotation mutex)', async () => {
  const post = jest.spyOn(axios, 'post').mockImplementation(
    () => new Promise(resolve =>
      setTimeout(() => resolve({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } } as never), 10)),
  );
  apiClient.defaults.adapter = adapterThat401sOnce();

  const [a, b, c] = await Promise.all([
    apiClient.get('/api/a'),
    apiClient.get('/api/b'),
    apiClient.get('/api/c'),
  ]);

  expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
  // THE PIN: three concurrent 401s, one refresh. Refresh tokens rotate, so a second call would
  // replay a consumed token, get a 400, and log the user out mid-session.
  expect(post).toHaveBeenCalledTimes(1);
});

it('logs the user out when the refresh itself fails, and does not retry forever', async () => {
  jest.spyOn(axios, 'post').mockRejectedValue(new Error('refresh rejected'));
  const adapter = adapterThat401sOnce();
  apiClient.defaults.adapter = adapter;
  let loggedOut = 0;
  registerUnauthenticatedCallback(() => { loggedOut++; });

  await expect(apiClient.get('/api/sessions')).rejects.toMatchObject({
    response: { status: 401 },
  });

  expect(loggedOut).toBe(1);
  // One attempt only — `_retry` must stop the interceptor re-entering on its own retry.
  expect(adapter).toHaveBeenCalledTimes(1);
});

it('stops after exactly ONE retry when the refreshed token is also rejected', async () => {
  // Pins the `_retry` flag, which the "failed refresh" test above does NOT reach: there the refresh
  // throws, so the interceptor never retries at all. The flag only matters when the RETRY itself
  // 401s — without it the interceptor re-enters its own retry and loops, refreshing forever.
  // (Verified by mutation: removing `!config?._retry` left every other test in this file green.)
  const post = jest.spyOn(axios, 'post').mockResolvedValue({
    data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
  } as never);
  let calls = 0;
  apiClient.defaults.adapter = jest.fn(async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    calls++;
    // Bounded so a missing guard fails fast instead of hanging the suite forever.
    if (calls > 5) throw new Error('interceptor looped: the _retry guard is missing');
    return settle(config, 401, {});
  });

  await expect(apiClient.get('/api/sessions')).rejects.toMatchObject({ response: { status: 401 } });

  expect(calls).toBe(2);                    // the original request plus exactly one retry
  expect(post).toHaveBeenCalledTimes(1);    // and exactly one refresh
});

it('does not attempt a refresh when there is no stored refresh token', async () => {
  getItem.mockResolvedValue(null);
  const post = jest.spyOn(axios, 'post');
  apiClient.defaults.adapter = adapterThat401sOnce();
  let loggedOut = 0;
  registerUnauthenticatedCallback(() => { loggedOut++; });

  await expect(apiClient.get('/api/sessions')).rejects.toMatchObject({ response: { status: 401 } });

  expect(post).not.toHaveBeenCalled();
  expect(loggedOut).toBe(1);
});

it('passes non-401 errors straight through without refreshing', async () => {
  const post = jest.spyOn(axios, 'post');
  apiClient.defaults.adapter = jest.fn(async (config: AxiosRequestConfig): Promise<AxiosResponse> =>
    settle(config, 403, { message: 'nope' }));

  await expect(apiClient.get('/api/sessions')).rejects.toMatchObject({ response: { status: 403 } });

  expect(post).not.toHaveBeenCalled();
});
