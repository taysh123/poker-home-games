import {
  emptyUsage, normalizeUsage, monthKey, rolloverIfNeeded, creditsRemaining, canAnalyze, recordUsage,
  type CoachUsage,
} from '../limits';
import { runAnalysis } from '../coachService';
import { mockCoachProvider } from '../../providers/mockCoachProvider';
import { getCoachProvider } from '../../providers';
import { AI_CREDIT_POLICY, type AiCreditPolicy } from '../../../premium/config';
import type { CoachInput } from '../../types';

const FREE: AiCreditPolicy = { kind: 'lifetime', credits: 1, minIntervalMs: 4000 };
const PREMIUM: AiCreditPolicy = { kind: 'monthly', credits: 30, minIntervalMs: 1000 };
const T0 = new Date('2026-06-19T12:00:00.000Z').getTime();
const manual: CoachInput = { kind: 'manual', format: 'cash', heroHand: 'AKs', heroPosition: 'BTN' };
const signed = { enforce: true, signedIn: true, requireAccount: true };

describe('fail-closed gate', () => {
  it('denies guests (no anonymous AI)', () => {
    const g = canAnalyze(emptyUsage(T0), FREE, T0, { enforce: true, signedIn: false, requireAccount: true });
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('requires_account');
  });
  it('denies when the policy is missing/unknown', () => {
    const g = canAnalyze(emptyUsage(T0), undefined, T0, signed);
    expect(g.allowed).toBe(false);
    expect(g.reason).toBe('no_credits');
  });
});

describe('free lifetime allowance (1, never resets)', () => {
  it('allows exactly one, then blocks even next month', () => {
    let u = emptyUsage(T0);
    expect(canAnalyze(u, FREE, T0, signed).allowed).toBe(true);
    u = recordUsage(u, T0);
    expect(creditsRemaining(u, FREE, T0)).toBe(0);
    const nextMonth = new Date('2026-07-02T12:00:00.000Z').getTime();
    expect(canAnalyze(u, FREE, nextMonth, signed)).toMatchObject({ allowed: false, reason: 'no_credits' });
  });
});

describe('premium monthly quota (30, resets monthly)', () => {
  it('blocks at the cap and refreshes next month', () => {
    let u: CoachUsage = { ...emptyUsage(T0), usedThisMonth: 30, usedLifetime: 30 };
    expect(canAnalyze(u, PREMIUM, T0 + 5000, signed)).toMatchObject({ allowed: false, reason: 'no_credits' });
    const nextMonth = new Date('2026-07-01T00:00:00.000Z').getTime();
    expect(creditsRemaining(u, PREMIUM, nextMonth)).toBe(30);
    expect(canAnalyze(u, PREMIUM, nextMonth, signed).allowed).toBe(true);
    expect(monthKey(nextMonth)).toBe('2026-07');
  });
  it('rate-limits within the min interval', () => {
    const u = recordUsage(emptyUsage(T0), T0);
    expect(canAnalyze(u, PREMIUM, T0 + 500, signed)).toMatchObject({ allowed: false, reason: 'rate_limited' });
  });
});

describe('recordUsage + normalize', () => {
  it('increments both monthly and lifetime counters', () => {
    const u = recordUsage(emptyUsage(T0), T0);
    expect(u.usedThisMonth).toBe(1);
    expect(u.usedLifetime).toBe(1);
  });
  it('normalizes a legacy usage missing usedLifetime', () => {
    expect(normalizeUsage({ schemaVersion: 1, monthKey: '2026-06', usedThisMonth: 3 } as any).usedLifetime).toBe(0);
  });
  it('config defaults are profit-protective (free lifetime 1, premium monthly 30)', () => {
    expect(AI_CREDIT_POLICY.free).toMatchObject({ kind: 'lifetime', credits: 1 });
    expect(AI_CREDIT_POLICY.premium).toMatchObject({ kind: 'monthly', credits: 30 });
  });
});

describe('runAnalysis orchestration', () => {
  it('produces an analysis + records usage for a signed-in user with credits', async () => {
    const out = await runAnalysis(mockCoachProvider, manual, {
      usage: emptyUsage(T0), policy: FREE, now: T0, enforce: true, signedIn: true, requireAccount: true,
    });
    expect(out.analysis).toBeDefined();
    expect(out.usage.usedLifetime).toBe(1);
  });
  it('denies a guest with no analysis (fail-closed)', async () => {
    const out = await runAnalysis(mockCoachProvider, manual, {
      usage: emptyUsage(T0), policy: FREE, now: T0, enforce: true, signedIn: false, requireAccount: true,
    });
    expect(out.analysis).toBeUndefined();
    expect(out.error).toBe('requires_account');
  });
});

describe('provider seam', () => {
  it('mock returns a structured analysis; factory falls back safely', async () => {
    const a = await mockCoachProvider.analyze({ input: manual });
    expect(a.providerId).toBe('mock');
    expect(a.disclaimer).toMatch(/not solver output/i);
    expect(getCoachProvider('openai').analyze).toBeDefined();
  });
});

// keep rollover sanity
describe('rolloverIfNeeded', () => {
  it('resets monthly but preserves lifetime', () => {
    const u: CoachUsage = { ...emptyUsage(T0), usedThisMonth: 5, usedLifetime: 9 };
    const r = rolloverIfNeeded(u, new Date('2026-07-01T00:00:00.000Z').getTime());
    expect(r.usedThisMonth).toBe(0);
    expect(r.usedLifetime).toBe(9);
  });
});
