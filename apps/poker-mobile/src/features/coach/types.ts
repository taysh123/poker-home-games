/**
 * AI Coach domain model (V2 — Improve pillar).
 *
 * Coach is a SERVICE LAYER, not a screen. Inputs are an extensible union (screenshot /
 * hand-history / manual / future), outputs are a fixed STRUCTURED shape, and the AI is
 * reached only through `ICoachProvider` — so vendors (OpenAI / Anthropic / Gemini /
 * self-hosted) are swappable with minimal change. Outputs are EDUCATIONAL coaching, not
 * solver output and never presented as mathematically optimal.
 */

export type CoachInputKind = 'screenshot' | 'hand_history' | 'manual';

export interface ScreenshotInput { kind: 'screenshot'; imageUri: string; note?: string }
export interface HandHistoryInput { kind: 'hand_history'; text: string; question?: string }
export interface ManualSpotInput {
  kind: 'manual';
  format: 'cash' | 'mtt';
  stackBb?: number;
  heroPosition?: string;
  villainPosition?: string;
  heroHand?: string;   // 'AKs' | 'AhKs'
  board?: string;      // optional postflop board
  actions?: string;    // free-text action line
  question?: string;   // what the user wants feedback on
}
export type CoachInput = ScreenshotInput | HandHistoryInput | ManualSpotInput;

export type CoachStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'general';
export interface CoachPoint { title: string; detail: string; street?: CoachStreet }
export interface AlternativeLine { line: string; rationale: string }
/** Qualitative confidence — explicitly NOT a numeric/EV claim. */
export type CoachConfidence = 'low' | 'medium' | 'high';

/** The consistent, structured coaching output rendered by the UI and stored in history. */
export interface CoachAnalysis {
  id: string;
  createdAt: string;
  inputKind: CoachInputKind;
  inputSummary: string;
  summary: string;
  mistakes: CoachPoint[];
  goodDecisions: CoachPoint[];
  alternativeLines: AlternativeLine[];
  tips: string[];
  confidence: CoachConfidence;
  /** Which provider/model produced this (transparency + future auditing). */
  providerId: string;
  disclaimer: string;
}

export const COACH_DISCLAIMER =
  'Educational coaching feedback — not solver output and not guaranteed mathematically optimal. ' +
  'Use it to learn, not as a GTO solution.';

/** Request passed to a provider. Kept minimal + vendor-neutral. */
export interface CoachRequest {
  input: CoachInput;
  locale?: string;
}

/**
 * Provider-agnostic AI seam. Implement once per vendor; the app depends only on this.
 * `analyze` must return the structured CoachAnalysis (providers map their raw output
 * into this shape). `signal` supports cancellation for future streaming/long calls.
 */
export interface ICoachProvider {
  readonly id: string;
  analyze(req: CoachRequest, signal?: AbortSignal): Promise<CoachAnalysis>;
}
