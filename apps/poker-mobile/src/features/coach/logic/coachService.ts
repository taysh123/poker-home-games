/**
 * Coach orchestrator — pure-ish glue between the limits layer and a provider. Checks the
 * (dormant) usage gate, calls the provider, records usage. Vendor- and UI-agnostic.
 */
import type { CoachInput, ICoachProvider } from '../types';
import {
  canAnalyze,
  recordUsage,
  rolloverIfNeeded,
  type CoachLimits,
  type CoachUsage,
  type CoachDenyReason,
} from './limits';
import type { CoachAnalysis } from '../types';

export interface AnalyzeContext {
  usage: CoachUsage;
  limits: CoachLimits;
  now?: number;
  /** Master cost-control switch (COACH_CONFIG.enforceLimits). Dormant in V1. */
  enforce?: boolean;
}

export interface AnalyzeOutcome {
  analysis?: CoachAnalysis;
  usage: CoachUsage;
  error?: CoachDenyReason;
}

export async function runAnalysis(
  provider: ICoachProvider,
  input: CoachInput,
  ctx: AnalyzeContext,
): Promise<AnalyzeOutcome> {
  const now = ctx.now ?? Date.now();
  const rolled = rolloverIfNeeded(ctx.usage, now);
  const gate = canAnalyze(rolled, ctx.limits, now, { enforce: ctx.enforce });
  if (!gate.allowed) return { usage: rolled, error: gate.reason };

  const analysis = await provider.analyze({ input });
  return { analysis, usage: recordUsage(rolled, now) };
}
