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
import { formatMoney } from '../utils/formatters';

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
  /** TRIM-based: any non-empty field counts, even if it fails to parse (matches the server). */
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
    const s = raw == null ? '' : String(raw);
    if (s.trim() === '') continue;
    // TRIM-based, matching the server's `some(v => v.trim() !== '')`: a non-empty-but-invalid field
    // (e.g. "abc") still counts as "entered". This only feeds `allowEmpty` + indicator visibility,
    // which the local exact/allowEmpty=false path never reads — but the server path does.
    hasAnyEntered = true;
    const n = model.parse(s);
    if (n == null) continue; // invalid entries don't add to the total
    totalEntered += n;
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

/**
 * Server sessions: decimal major-units with an optional chips↔money toggle — mirrors SessionScreen.
 * `expectedRemainingUnits` is already scaled by the screen (× chipRatio when counting in chips), so
 * this stays pure. Reproduces the server exactly, byte for byte:
 *   - parse: `!isNaN(parseFloat) && >= 0` (so junk / negatives are dropped; the same filter as
 *     SessionScreen:1736);
 *   - tolerance: `|diff| < 0.5` in the toggled unit (NOT converged — see spec slice 2.1b);
 *   - allowEmpty: true (no entries ⇒ balanced, matching `!hasAnyEntered`);
 *   - format: chips → `Math.round(n).toLocaleString()`, money → `formatMoney(n)`.
 * `unitLabel` is 'chips' in chip-mode and '' in money-mode. (The server previously appended the
 * currency symbol as the money-mode unit label, producing a redundant "₪40 ₪" in the indicator;
 * dropping it here is the one intentional copy fix in the extraction — the numbers/gate are identical.)
 */
export function decimalFinalCountModel(opts: { expectedRemainingUnits: number; useChips: boolean }): FinalCountModel {
  const { expectedRemainingUnits, useChips } = opts;
  return {
    parse: (s) => { const n = parseFloat(s); return !isNaN(n) && n >= 0 ? n : null; },
    format: (n) => (useChips ? Math.round(n).toLocaleString() : formatMoney(n)),
    expectedRemaining: expectedRemainingUnits,
    allowEmpty: true,
    isWithinTolerance: (diff) => Math.abs(diff) < 0.5,
    unitLabel: useChips ? 'chips' : '',
  };
}
