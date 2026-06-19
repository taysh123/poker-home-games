/**
 * Coach orchestrator — pure glue between the credit engine and a provider. Fail-closed:
 * checks the gate (account required, credits, rate limit) BEFORE calling the provider, then
 * records usage. Vendor- and UI-agnostic.
 */
import type { CoachInput, ICoachProvider, CoachAnalysis } from '../types';
import type { AiCreditPolicy } from '../../premium/config';
import { canAnalyze, recordUsage, rolloverIfNeeded, type CoachUsage, type CoachDenyReason } from './limits';

export interface AnalyzeContext {
  usage: CoachUsage;
  policy: AiCreditPolicy | undefined;
  now?: number;
  enforce: boolean;
  signedIn: boolean;
  requireAccount: boolean;
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
  const gate = canAnalyze(rolled, ctx.policy, now, {
    enforce: ctx.enforce,
    signedIn: ctx.signedIn,
    requireAccount: ctx.requireAccount,
  });
  if (!gate.allowed) return { usage: rolled, error: gate.reason };

  const analysis = await provider.analyze({ input });
  return { analysis, usage: recordUsage(rolled, now) };
}
