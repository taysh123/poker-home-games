/**
 * B4 — server-authoritative monetization API contract + error mapping (fail-closed).
 * Pure mapping is tested directly; the HTTP wrappers are tested against a mocked apiClient.
 */
jest.mock('../apiClient', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

import apiClient from '../apiClient';
import {
  getEntitlements,
  getCoachCredits,
  analyzeHand,
  mapCoachError,
  ServerCoachError,
  type AnalyzeRequest,
} from '../monetizationApi';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

const req: AnalyzeRequest = { kind: 'manual', heroHand: 'AKs', idempotencyKey: 'idem-1' };

describe('mapCoachError — server status → CoachError (fail-closed)', () => {
  it('maps 402 → no_credits', () => {
    expect(mapCoachError({ response: { status: 402 } }).reason).toBe('no_credits');
  });
  it('maps 429 → rate_limited', () => {
    expect(mapCoachError({ response: { status: 429 } }).reason).toBe('rate_limited');
  });
  it('maps 401 and 403 → requires_account', () => {
    expect(mapCoachError({ response: { status: 401 } }).reason).toBe('requires_account');
    expect(mapCoachError({ response: { status: 403 } }).reason).toBe('requires_account');
  });
  it('maps network/unknown errors → unavailable (deny, no false paywall)', () => {
    expect(mapCoachError({ message: 'Network Error' }).reason).toBe('unavailable');
    expect(mapCoachError({ response: { status: 500 } }).reason).toBe('unavailable');
    expect(mapCoachError(undefined).reason).toBe('unavailable');
  });
});

describe('getEntitlements / getCoachCredits — attach bearer token, return server data', () => {
  it('reads entitlements with the auth header', async () => {
    mockGet.mockResolvedValue({ data: { plan: 'premium', status: 'active', productId: 'p', expiresAt: null } });
    const ent = await getEntitlements('tok');
    expect(ent.plan).toBe('premium');
    expect(mockGet).toHaveBeenCalledWith('/api/entitlements', { headers: { Authorization: 'Bearer tok' } });
  });
  it('reads coach credits with the auth header', async () => {
    mockGet.mockResolvedValue({ data: { remaining: 5, total: 30, policyKind: 'monthly', isPremium: true } });
    const c = await getCoachCredits('tok');
    expect(c).toMatchObject({ remaining: 5, total: 30, policyKind: 'monthly', isPremium: true });
    expect(mockGet).toHaveBeenCalledWith('/api/coach/credits', { headers: { Authorization: 'Bearer tok' } });
  });
});

describe('analyzeHand — proxy success + error mapping', () => {
  it('returns the server analysis result on success', async () => {
    mockPost.mockResolvedValue({ data: { summary: 'ok', mistakes: [], goodDecisions: [], alternativeLines: [], tips: [], confidence: 'medium', providerId: 'mock', disclaimer: 'd' } });
    const r = await analyzeHand(req, 'tok');
    expect(r.summary).toBe('ok');
    expect(mockPost).toHaveBeenCalledWith('/api/coach/analyze', req, { headers: { Authorization: 'Bearer tok' } });
  });
  it('throws a ServerCoachError(no_credits) on 402', async () => {
    mockPost.mockRejectedValue({ response: { status: 402 } });
    await expect(analyzeHand(req, 'tok')).rejects.toBeInstanceOf(ServerCoachError);
    await expect(analyzeHand(req, 'tok')).rejects.toMatchObject({ reason: 'no_credits' });
  });
  it('throws a ServerCoachError(rate_limited) on 429', async () => {
    mockPost.mockRejectedValue({ response: { status: 429 } });
    await expect(analyzeHand(req, 'tok')).rejects.toMatchObject({ reason: 'rate_limited' });
  });
  it('throws a ServerCoachError(unavailable) on a network failure (fail-closed)', async () => {
    mockPost.mockRejectedValue({ message: 'Network Error' });
    await expect(analyzeHand(req, 'tok')).rejects.toMatchObject({ reason: 'unavailable' });
  });
});
