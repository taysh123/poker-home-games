/**
 * The Final Count — pure balance core, money-model-agnostic.
 *
 * Both the server session (decimal + chips toggle) and local games (integer cents) end with the
 * SAME balance question: do the entered remaining stacks add up to the pot minus what already
 * cashed out? Only the money model differs. This computes the balance state from entered strings +
 * a `FinalCountModel` that encodes ONE model's exact rules (tolerance, empty-allowance, parsing,
 * formatting). Sibling to settlements.ts.
 *
 * This module is deliberately behavior-preserving: the two model factories below reproduce the
 * existing on-screen behavior verbatim. Converging the divergent tolerances is a SEPARATE, queued
 * decision (see the master plan, slice 2.1b) — do not change the math here to "unify" it.
 */
import { formatCents, parseAmountToCents } from '../utils/money';

export interface FinalCountModel {
  /** Parse an entered stack string → numeric amount in the model's balance unit, or null if it should not count. */
  parse(input: string): number | null;
  /** Format a numeric balance-unit amount for the indicator. */
  format(n: number): string;
  /** Expected remaining total (buy-ins − cash-outs) in the model's balance unit. */
  expectedRemaining: number;
  /** Whether "no entries at all" counts as balanced (server: true; local: false). */
  allowEmpty: boolean;
  /** The model's own "close enough" test on (entered − expected). Exact for cents; |diff| < 0.5 for decimal/chips. */
  isWithinTolerance(diff: number): boolean;
  /** Unit word for the indicator ("chips" or ""). */
  unitLabel: string;
}

export interface FinalCountState {
  totalEntered: number;
  expected: number;
  /** totalEntered − expected (signed). */
  diff: number;
  hasAnyEntered: boolean;
  /** (allowEmpty && !hasAnyEntered) || isWithinTolerance(diff). */
  isBalanced: boolean;
  /** Entered more than expected, beyond tolerance. */
  over: boolean;
  /** Entered less than expected, beyond tolerance. */
  short: boolean;
}

export function computeFinalCount(
  entered: Record<string, string>,
  model: FinalCountModel,
): FinalCountState {
  let totalEntered = 0;
  let hasAnyEntered = false;
  for (const raw of Object.values(entered)) {
    if (raw == null || String(raw).trim() === '') continue;
    const n = model.parse(String(raw));
    if (n == null) continue; // invalid entries are ignored — they don't count toward the total
    totalEntered += n;
    hasAnyEntered = true;
  }
  const expected = model.expectedRemaining;
  const diff = totalEntered - expected;
  const within = model.isWithinTolerance(diff);
  const isBalanced = (model.allowEmpty && !hasAnyEntered) || within;
  return {
    totalEntered,
    expected,
    diff,
    hasAnyEntered,
    isBalanced,
    over: hasAnyEntered && diff > 0 && !within,
    short: hasAnyEntered && diff < 0 && !within,
  };
}

/**
 * Local games: integer cents, EXACT balance, no empty allowance — mirrors LocalSessionScreen's
 * `stacksMismatch = stacksTotalCents !== remainingCents` gate. `parseAmountToCents` returns null for
 * invalid / negative / zero, so those entries are ignored (matching the screen's parse behavior).
 */
export function centsFinalCountModel(expectedRemainingCents: number): FinalCountModel {
  return {
    parse: (s) => parseAmountToCents(s),
    format: (n) => formatCents(n),
    expectedRemaining: expectedRemainingCents,
    allowEmpty: false,
    isWithinTolerance: (diff) => diff === 0,
    unitLabel: '',
  };
}
