/**
 * B4 — serverCoachProvider maps the server CoachAnalysisResult → the client CoachAnalysis shape,
 * and surfaces ServerCoachError unchanged (so CoachContext can map it to a CoachError). Fail-closed
 * when there is no signed-in token.
 */
jest.mock('../../../../utils/storage', () => ({ getItemAsync: jest.fn() }));
jest.mock('../../../../api/monetizationApi', () => ({
  __esModule: true,
  analyzeHand: jest.fn(),
  ServerCoachError: class ServerCoachError extends Error {
    reason: string;
    constructor(reason: string) { super(reason); this.reason = reason; this.name = 'ServerCoachError'; }
  },
}));

import * as SecureStore from '../../../../utils/storage';
import { analyzeHand, ServerCoachError } from '../../../../api/monetizationApi';
import { serverCoachProvider } from '../serverCoachProvider';
import type { CoachInput } from '../../types';

const mockGetToken = SecureStore.getItemAsync as jest.Mock;
const mockAnalyze = analyzeHand as jest.Mock;

const manual: CoachInput = { kind: 'manual', format: 'cash', heroHand: 'AKs', heroPosition: 'BTN', question: 'thin?' };

const serverResult = {
  summary: 'Coaching read',
  mistakes: [{ title: 'Sizing', detail: 'be consistent', street: 'flop' }],
  goodDecisions: [{ title: 'Position', detail: 'good', street: 'preflop' }],
  alternativeLines: [{ line: 'smaller cbet', rationale: 'protect range' }],
  tips: ['have a plan'],
  confidence: 'high',
  providerId: 'mock',
  disclaimer: 'Educational coaching feedback — not solver output.',
};

beforeEach(() => {
  mockGetToken.mockReset();
  mockAnalyze.mockReset();
});

describe('serverCoachProvider', () => {
  it('has the server provider id', () => {
    expect(serverCoachProvider.id).toBe('server');
  });

  it('maps a server result to a well-formed CoachAnalysis', async () => {
    mockGetToken.mockResolvedValue('tok');
    mockAnalyze.mockResolvedValue(serverResult);

    const a = await serverCoachProvider.analyze({ input: manual });

    expect(a.id).toMatch(/^coach-/);
    expect(typeof a.createdAt).toBe('string');
    expect(a.inputKind).toBe('manual');
    expect(a.inputSummary.length).toBeGreaterThan(0);
    expect(a.summary).toBe('Coaching read');
    expect(a.mistakes).toHaveLength(1);
    expect(a.confidence).toBe('high');
    expect(a.providerId).toBe('mock');
    expect(a.disclaimer).toMatch(/not solver output/i);

    // sent a request carrying an idempotency key + the hand
    const sent = mockAnalyze.mock.calls[0][0];
    expect(sent.kind).toBe('manual');
    expect(sent.heroHand).toBe('AKs');
    expect(sent.idempotencyKey).toBeTruthy();
  });

  it('throws requires_account (fail-closed) when there is no token', async () => {
    mockGetToken.mockResolvedValue(null);
    await expect(serverCoachProvider.analyze({ input: manual })).rejects.toMatchObject({ reason: 'requires_account' });
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it('re-throws a ServerCoachError from the API unchanged', async () => {
    mockGetToken.mockResolvedValue('tok');
    mockAnalyze.mockRejectedValue(new ServerCoachError('no_credits'));
    await expect(serverCoachProvider.analyze({ input: manual })).rejects.toMatchObject({ reason: 'no_credits' });
  });
});
