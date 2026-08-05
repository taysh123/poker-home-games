/**
 * The 401 → refresh → retry interceptor, exercised against the REAL axios.
 *
 * Why this exists: the axios CVE bump (T0.4) changes the library this interceptor is built on, and
 * the plan's verification step said to "confirm apiClient tests specifically pass" — there were
 * none. The whole suite passing said nothing about the single highest-risk consumer of the bump.
 *
 * These drive axios itself (a fake `adapter`, not a mocked axios), so they exercise the real
 * interceptor chain, real AxiosHeaders normalisation, real transformResponse, and config identity
 * across the retry.
 *
 * SCOPE LIMIT, stated because the previous version of this comment overclaimed: a fake adapter
 * REPLACES the layer where axios enforces `settle`/`validateStatus`, `buildFullPath` (baseURL
 * joining) and `timeout` — all three live in the built-in adapters, not in `dispatchRequest`. So
 * those behaviours are NOT exercised here; the tests below assert only that the options reach the
 * adapter intact. Anything relying on adapter-level enforcement needs a different harness.
 *
 * The mutex is the load-bearing part: the backend rotates refresh tokens, so replaying a consumed
 * one returns 400. Before the mutex, concurrent 401s each fired their own refresh and the losers
 * cascaded into forced logouts.
 */
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axios, { AxiosError } from 'axios';

jest.mock('../../utils/storage');

import * as storage from '../../utils/storage';
import { API_BASE_URL } from '../config';
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
  // THE REFRESH REQUEST ITSELF, not just that one happened. Asserting only the call COUNT let two
  // production-breaking mutations pass: renaming the body key `token` (the backend's
  // RefreshTokenCommand binds `token`, so every refresh would 400) and changing the path (every
  // refresh would 404). A refresh that fires but is malformed produces exactly the cascading
  // forced-logout this interceptor exists to prevent, so the contract is pinned literally.
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(
    `${API_BASE_URL}/api/auth/refresh`,
    { token: 'refresh-token-1' },
    { headers: { 'Content-Type': 'application/json' } },
  );
  // The retry carries the refreshed token, not the stale one.
  const retry = adapter.mock.calls[1][0];
  expect(retry.headers?.['Authorization']).toBe('Bearer new-access');
  // The instance options survive into the adapter (they are not ENFORCED here — see the scope
  // limit at the top of this file — but a bump that dropped them would still be caught).
  expect(retry.baseURL).toBe(API_BASE_URL);
  expect(retry.timeout).toBe(10000);
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
  let loggedOut = 0;
  registerUnauthenticatedCallback(() => { loggedOut++; });

  await expect(apiClient.get('/api/sessions')).rejects.toMatchObject({ response: { status: 401 } });

  expect(calls).toBe(2);                    // the original request plus exactly one retry
  expect(post).toHaveBeenCalledTimes(1);    // and exactly one refresh
  // CURRENT behaviour, pinned in both directions so a change is visible rather than silent: the
  // user is NOT logged out here. `return apiClient(config)` is not awaited, so the retry's
  // rejection leaves the try block without reaching the catch that calls onUnauthenticated — the
  // user keeps a dead access token and the screen surfaces a raw 401. Whether that is RIGHT is an
  // open question recorded as a follow-up; it is deliberately not changed in a dependency-bump
  // slice, but it is no longer unobserved.
  expect(loggedOut).toBe(0);
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
