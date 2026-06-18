/**
 * Mock coach provider — drives the full UX end-to-end with NO vendor/network. Returns a
 * deterministic, well-formed CoachAnalysis so the app, history, and rendering work today.
 * A real provider (OpenAI/Anthropic/Gemini/self) implements the same ICoachProvider and
 * maps its raw output into this same structure.
 */
import {
  COACH_DISCLAIMER,
  type CoachAnalysis,
  type CoachInput,
  type CoachRequest,
  type ICoachProvider,
} from '../types';

let counter = 0;

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

export const mockCoachProvider: ICoachProvider = {
  id: 'mock',
  async analyze(req: CoachRequest): Promise<CoachAnalysis> {
    const { input } = req;
    const inputSummary = summarizeInput(input);
    const focus =
      input.kind === 'manual' ? input.question :
      input.kind === 'hand_history' ? input.question : undefined;

    return {
      id: `coach-${Date.now()}-${++counter}`,
      createdAt: new Date().toISOString(),
      inputKind: input.kind,
      inputSummary,
      summary:
        `Here's a coaching read on ${inputSummary.toLowerCase()}. ` +
        (focus ? `You asked about: "${focus}". ` : '') +
        'Overall the line is reasonable; a few adjustments would tighten it up.',
      mistakes: [
        { title: 'Sizing could be more consistent', detail: 'Mixing bet sizes without a clear reason makes you easier to read. Pick sizes that match your range.', street: 'general' },
      ],
      goodDecisions: [
        { title: 'Position awareness', detail: 'Playing tighter out of position is the right instinct and limits tough spots later.', street: 'preflop' },
      ],
      alternativeLines: [
        { line: 'Consider a smaller continuation bet on dry boards', rationale: 'You can bet more often for less, keeping your range protected.' },
      ],
      tips: [
        'Have a default plan for each street before you act.',
        'Note the spot afterward — reviewing your own reads builds the fastest.',
      ],
      confidence: 'medium',
      providerId: 'mock',
      disclaimer: COACH_DISCLAIMER,
    };
  },
};
