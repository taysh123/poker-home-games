import {
  emptyUsage, monthKey, rolloverIfNeeded, creditsRemaining, canAnalyze, recordUsage,
  type CoachLimits,
} from '../limits';
import { runAnalysis } from '../coachService';
import { mockCoachProvider } from '../../providers/mockCoachProvider';
import { getCoachProvider } from '../../providers';
import type { CoachInput } from '../../types';

const LIMITS: CoachLimits = { monthlyCredits: 3, minIntervalMs: 1000 };
const T0 = new Date('2026-06-18T12:00:00.000Z').getTime();
const manual: CoachInput = { kind: 'manual', format: 'cash', heroHand: 'AKs', heroPosition: 'BTN' };

describe('usage limits (dormant unless enforced)', () => {
  it('allows freely when not enforcing but still reports remaining', () => {
    const g = canAnalyze(emptyUsage(T0), LIMITS, T0, { enforce: false });
    expect(g.allowed).toBe(true);
    expect(g.remaining).toBe(3);
  });

  it('blocks on no credits when enforced', () => {
    let u = emptyUsage(T0);
    u = { ...u, usedThisMonth: 3 };
    const g = canAnalyze(u, LIMITS, T0 + 5000, { enforce: true });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('no_credits');
  });

  it('rate-limits within the min interval when enforced', () => {
    const u = recordUsage(emptyUsage(T0), T0);
    const g = canAnalyze(u, LIMITS, T0 + 500, { enforce: true }); // 500ms < 1000ms
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('rate_limited');
  });

  it('rolls over credits on a new month', () => {
    const u = { ...emptyUsage(T0), usedThisMonth: 3 };
    const nextMonth = new Date('2026-07-01T00:00:00.000Z').getTime();
    expect(rolloverIfNeeded(u, nextMonth).usedThisMonth).toBe(0);
    expect(creditsRemaining(u, LIMITS, nextMonth)).toBe(3);
    expect(monthKey(nextMonth)).toBe('2026-07');
  });
});

describe('mock provider output shape', () => {
  it('returns a fully structured, educational analysis', async () => {
    const a = await mockCoachProvider.analyze({ input: manual });
    expect(a.inputKind).toBe('manual');
    expect(typeof a.summary).toBe('string');
    expect(Array.isArray(a.mistakes)).toBe(true);
    expect(Array.isArray(a.goodDecisions)).toBe(true);
    expect(Array.isArray(a.alternativeLines)).toBe(true);
    expect(Array.isArray(a.tips)).toBe(true);
    expect(a.providerId).toBe('mock');
    expect(a.disclaimer).toMatch(/not solver output/i);
    expect(['low', 'medium', 'high']).toContain(a.confidence);
  });

  it('factory returns a provider implementing the interface', () => {
    expect(getCoachProvider('mock').id).toBe('mock');
    expect(getCoachProvider('openai').analyze).toBeDefined(); // falls back to mock until wired
  });
});

describe('runAnalysis orchestration', () => {
  it('produces an analysis and increments usage', async () => {
    const out = await runAnalysis(mockCoachProvider, manual, { usage: emptyUsage(T0), limits: LIMITS, now: T0, enforce: false });
    expect(out.analysis).toBeDefined();
    expect(out.usage.usedThisMonth).toBe(1);
    expect(out.error).toBeUndefined();
  });

  it('returns an error and no analysis when the gate denies (enforced, no credits)', async () => {
    const usage = { ...emptyUsage(T0), usedThisMonth: 3 };
    const out = await runAnalysis(mockCoachProvider, manual, { usage, limits: LIMITS, now: T0 + 5000, enforce: true });
    expect(out.analysis).toBeUndefined();
    expect(out.error).toBe('no_credits');
  });
});
