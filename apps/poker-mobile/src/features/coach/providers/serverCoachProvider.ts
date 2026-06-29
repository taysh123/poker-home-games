/**
 * Server coach provider (B4) — the production AI seam. Implements the same `ICoachProvider` the UI
 * already depends on, but the analysis runs on the SERVER (`POST /api/coach/analyze`): the vendor
 * key, credit reservation, and enforcement all live server-side. The client only renders the result.
 *
 * Fail-closed: no signed-in token ⇒ `requires_account` (no anonymous AI). Server enforcement errors
 * (402/403/429/offline) surface as `ServerCoachError` for `CoachContext` to map to a `CoachError`.
 */
import * as SecureStore from '../../../utils/storage';
import { analyzeHand, ServerCoachError, type AnalyzeRequest } from '../../../api/monetizationApi';
import {
  COACH_DISCLAIMER,
  type CoachAnalysis,
  type CoachConfidence,
  type CoachInput,
  type CoachRequest,
  type ICoachProvider,
} from '../types';

function newId(): string {
  return `coach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function summarizeInput(input: CoachInput): string {
  switch (input.kind) {
    case 'screenshot': return 'Screenshot spot';
    case 'hand_history': return 'Pasted hand history';
    case 'manual': {
      const bits = [input.heroHand, input.heroPosition && `from ${input.heroPosition}`, `(${input.format})`].filter(Boolean);
      return bits.join(' ') || 'Manual spot';
    }
  }
}

/** Map the extensible client input union onto the flat server command. */
function toAnalyzeRequest(input: CoachInput): AnalyzeRequest {
  const idempotencyKey = newId();
  switch (input.kind) {
    case 'hand_history':
      return { kind: 'hand_history', text: input.text, question: input.question, idempotencyKey };
    case 'manual':
      return {
        kind: 'manual',
        heroHand: input.heroHand,
        heroPosition: input.heroPosition,
        question: input.question,
        text: input.actions, // action line carried as free text
        idempotencyKey,
      };
    case 'screenshot':
      return { kind: 'screenshot', question: input.note, idempotencyKey };
  }
}

export const serverCoachProvider: ICoachProvider = {
  id: 'server',
  async analyze(req: CoachRequest): Promise<CoachAnalysis> {
    const { input } = req;
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) throw new ServerCoachError('requires_account'); // no anonymous AI

    const r = await analyzeHand(toAnalyzeRequest(input), token); // throws ServerCoachError on denial

    return {
      id: newId(),
      createdAt: new Date().toISOString(),
      inputKind: input.kind,
      inputSummary: summarizeInput(input),
      summary: r.summary,
      mistakes: (r.mistakes ?? []).map(m => ({ title: m.title, detail: m.detail, street: m.street as CoachAnalysis['mistakes'][number]['street'] })),
      goodDecisions: (r.goodDecisions ?? []).map(m => ({ title: m.title, detail: m.detail, street: m.street as CoachAnalysis['goodDecisions'][number]['street'] })),
      alternativeLines: (r.alternativeLines ?? []).map(a => ({ line: a.line, rationale: a.rationale })),
      tips: r.tips ?? [],
      confidence: ((r.confidence as CoachConfidence) ?? 'medium'),
      providerId: r.providerId || 'server',
      disclaimer: r.disclaimer || COACH_DISCLAIMER,
    };
  },
};
