# The Final Count — Extraction & Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the duplicated "The Final Count" end-game flow (money-critical) from two hand-maintained copies into one pure core + one shared component + two money adapters, **changing zero observable behavior**, so slices 2.2/2.4 can build on a single results surface.

**Architecture:** A pure, unit-tested core (`local/finalCount.ts`) computes the balance state from entered stacks and a **money adapter** that encodes each model's exact current semantics (integer-cents/exact vs decimal-or-chips/0.5-tolerance). A shared presentational component (`components/FinalCountSheet.tsx`) owns the canonical copy + markup once. Each screen keeps only its open/close state, adapter construction, and settle side-effect. This is a **behavior-preserving refactor**: the adapters reproduce today's exact tolerance, validation, empty-allowance, and formatting — unifying the *structure*, never the *math*.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, `@testing-library/react-native` + `jest-expo`, existing pure-logic sibling `local/settlements.ts`, `utils/money.ts`.

## Global Constraints

- **Money is integer cents in `local/`** (`utils/money.ts`: `formatCents`, `parseAmountToCents`); the server side is decimal major-units. NEVER store floats in local. — verbatim from CLAUDE.md.
- **Behavior-preserving:** every extraction task must leave the exact current on-screen behavior (when "End Game & Settle" is enabled/disabled, what the indicator reads, what gets settled). Any intended *semantic* convergence (e.g. tightening the server's 0.5-chip tolerance) is OUT OF SCOPE for 2.1 and is a separate, owner-approved decision.
- **Canonical copy stays verbatim:** title "The Final Count", subtitle "Last step — count each player's remaining chips. We'll settle the rest." (server swaps "chips"/"cash" dynamically), "Busted · ₪0", "Counted X of Y … on the table", the inline "End anyway with an unbalanced count" override, the finality footer, and the "Keep Playing" / "End Game & Settle" pair. After PR B these live in ONE component.
- **Settlement math is pinned** by `local/__tests__/settlements.test.ts` (TS port ↔ C# `SettlementCalculatorService.cs`). This slice does not touch `settlements.ts` or the C# engine.
- **Tests-first (TDD)** for every logic change. `npx tsc --noEmit` and `npx jest` must pass before each commit (run from `apps/poker-mobile`).
- **Ship invariants:** nothing purchasable; guests keep the full experience; honesty/classification pins never weakened.

## Slice shape — three PRs, stop for owner review + merge between each

- **PR A** (Tasks 1–4) — **SHIPPED (#44).** Pure core + **cents** adapter + wire `LocalSessionScreen` + first end-game screen test.
- **PR B** (Task 5 + server wiring) — **SHIPPED (#45).** **decimal/chips** adapter + wire `SessionScreen`'s gate to the shared core. Behavior-preserving MATH unification (both gates on one tested `computeFinalCount`), verified by the adversarial before/after truth-table. Server presentation untouched.
- **PR B2 — shared `FinalCountSheet` component — DEFERRED post-launch** (owner, 2026-07-23). Converging the two Final Count *markups* is visual churn on a money screen; deferred so it can't invalidate the store screenshots / tested submission build. See the master-plan "Deferred post-launch" cluster.
- **PR C — churn-free results DATA extraction** (owner decision, 2026-07-23). Extract only the shared results **data** (`local/gameResults.ts` — the pure normalizer currently inline in `LocalSessionSummaryScreen`), consumed by that screen with ZERO visual change. Does NOT converge the two in-app results *renderings* (server Game-Over ↔ local summary are structurally different — Mark-Paid buttons vs buy-ins hero); that convergence is folded into **2.2 Results Card 2.0**'s design pass. The server-source normalizer is added there too (API-shaped; no independent consumer today).

> PR A is fully specified below (historical). PR C is a small faithful extraction of the local results `useMemo`; behavior-preserving, pinned by the existing settlement fixtures.

---

## File Structure

- **Create `apps/poker-mobile/src/local/finalCount.ts`** — pure core. `FinalCountModel` interface, `FinalCountState` type, `computeFinalCount(entered, model)`, and the two model factories `centsFinalCountModel(...)` / `decimalFinalCountModel(...)`. Sits beside `settlements.ts` (its closest conceptual sibling — pure game-money logic). Imported by both the local and server screens; it has NO screen/DTO dependency (factories take primitive inputs).
- **Create `apps/poker-mobile/src/local/__tests__/finalCount.test.ts`** — pure unit tests for the core + both models.
- **Create `apps/poker-mobile/src/components/FinalCountSheet.tsx`** (PR B) — the shared presentational sheet. Owns the canonical copy + rows + indicator + override + footer + actions once.
- **Create `apps/poker-mobile/src/screens/__tests__/LocalSessionScreen.finalcount.test.tsx`** (PR A) and `SessionScreen.finalcount.test.tsx` (PR B) — end-game screen tests (new harness for this surface).
- **Create `apps/poker-mobile/src/components/GameResults.tsx`** (PR C) — shared results/settlement rendering.
- **Modify** `screens/LocalSessionScreen.tsx` (PR A wiring, PR B component adoption), `screens/SessionScreen.tsx` (PR B), `screens/LocalSessionSummaryScreen.tsx` (PR C).

---

## PR A — pure core + cents adapter + local wiring + first screen test

### Task 1: Pure core `computeFinalCount` + types

**Files:**
- Create: `apps/poker-mobile/src/local/finalCount.ts`
- Test: `apps/poker-mobile/src/local/__tests__/finalCount.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface FinalCountModel {
    /** Parse an entered stack string → numeric amount in the model's balance unit, or null if it should not count. */
    parse(input: string): number | null;
    /** Format a numeric balance-unit amount for the indicator. */
    format(n: number): string;
    /** Expected remaining total (buy-ins − cash-outs) in the model's balance unit. */
    expectedRemaining: number;
    /** Whether "no entries at all" counts as balanced (server: true; local: false). */
    allowEmpty: boolean;
    /** Model's own "close enough" test on (entered − expected). Exact for cents; |diff| < 0.5 for decimal/chips. */
    isWithinTolerance(diff: number): boolean;
    /** Unit word for the indicator ("chips" or ""). */
    unitLabel: string;
  }
  export interface FinalCountState {
    totalEntered: number;
    expected: number;
    diff: number;            // totalEntered − expected
    hasAnyEntered: boolean;
    isBalanced: boolean;     // (allowEmpty && !hasAnyEntered) || isWithinTolerance(diff)
    over: boolean;           // hasAnyEntered && diff  >  0 && !isWithinTolerance(diff)
    short: boolean;          // hasAnyEntered && diff  <  0 && !isWithinTolerance(diff)
  }
  export function computeFinalCount(
    entered: Record<string, string>,
    model: FinalCountModel,
  ): FinalCountState;
  ```

- [ ] **Step 1: Write the failing test** — `apps/poker-mobile/src/local/__tests__/finalCount.test.ts`

```ts
import { computeFinalCount, type FinalCountModel } from '../finalCount';

/** Minimal exact-integer model for exercising the core (mirrors the cents model's rules). */
const exact = (expectedRemaining: number): FinalCountModel => ({
  parse: (s) => { const n = Number(s); return Number.isInteger(n) && n >= 0 ? n : null; },
  format: (n) => String(n),
  expectedRemaining,
  allowEmpty: false,
  isWithinTolerance: (diff) => diff === 0,
  unitLabel: '',
});

describe('computeFinalCount', () => {
  it('balances when entries sum exactly to the expected remaining', () => {
    const s = computeFinalCount({ a: '600', b: '400' }, exact(1000));
    expect(s.totalEntered).toBe(1000);
    expect(s.diff).toBe(0);
    expect(s.isBalanced).toBe(true);
    expect(s.over).toBe(false);
    expect(s.short).toBe(false);
  });

  it('is short when entries undercount', () => {
    const s = computeFinalCount({ a: '600', b: '300' }, exact(1000));
    expect(s.diff).toBe(-100);
    expect(s.isBalanced).toBe(false);
    expect(s.short).toBe(true);
  });

  it('is over when entries overcount', () => {
    const s = computeFinalCount({ a: '600', b: '600' }, exact(1000));
    expect(s.diff).toBe(200);
    expect(s.over).toBe(true);
    expect(s.isBalanced).toBe(false);
  });

  it('skips blank and invalid entries (they do not count toward the total or hasAnyEntered)', () => {
    const s = computeFinalCount({ a: '', b: '  ', c: 'abc', d: '-5' }, exact(1000));
    expect(s.totalEntered).toBe(0);
    expect(s.hasAnyEntered).toBe(false);
  });

  it('with allowEmpty=false, no entries is NOT balanced (local semantics)', () => {
    const s = computeFinalCount({}, exact(1000));
    expect(s.hasAnyEntered).toBe(false);
    expect(s.isBalanced).toBe(false);
  });

  it('with allowEmpty=true, no entries IS balanced (server semantics)', () => {
    const model: FinalCountModel = { ...exact(1000), allowEmpty: true };
    const s = computeFinalCount({}, model);
    expect(s.isBalanced).toBe(true);
  });

  it('respects a non-zero tolerance without changing the raw diff', () => {
    const model: FinalCountModel = { ...exact(1000), isWithinTolerance: (d) => Math.abs(d) < 0.5 };
    const s = computeFinalCount({ a: '1000.4' as unknown as string }, { ...model, parse: (x) => Number(x) });
    expect(Math.abs(s.diff)).toBeCloseTo(0.4);
    expect(s.isBalanced).toBe(true); // within 0.5
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/poker-mobile && npx jest src/local/__tests__/finalCount.test.ts`
Expected: FAIL — `Cannot find module '../finalCount'`.

- [ ] **Step 3: Implement the minimal core** — `apps/poker-mobile/src/local/finalCount.ts`

```ts
/**
 * The Final Count — pure balance core, money-model-agnostic.
 *
 * Both the server session (decimal + chips toggle) and local games (integer cents) end with the
 * SAME balance question: do the entered remaining stacks add up to the pot minus what already
 * cashed out? Only the money model differs. This computes the balance state from entered strings +
 * a `FinalCountModel` that encodes ONE model's exact rules. Sibling to settlements.ts.
 */
export interface FinalCountModel {
  parse(input: string): number | null;
  format(n: number): string;
  expectedRemaining: number;
  allowEmpty: boolean;
  isWithinTolerance(diff: number): boolean;
  unitLabel: string;
}

export interface FinalCountState {
  totalEntered: number;
  expected: number;
  diff: number;
  hasAnyEntered: boolean;
  isBalanced: boolean;
  over: boolean;
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
    if (n == null) continue; // invalid entries are ignored (do not count)
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/poker-mobile && npx jest src/local/__tests__/finalCount.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/local/finalCount.ts apps/poker-mobile/src/local/__tests__/finalCount.test.ts
git commit -m "feat(final-count): pure balance core (money-model-agnostic)"
```

### Task 2: Cents model factory (behavior-preserving for local)

**Files:**
- Modify: `apps/poker-mobile/src/local/finalCount.ts` (add `centsFinalCountModel`)
- Test: `apps/poker-mobile/src/local/__tests__/finalCount.test.ts` (add a describe block)

**Interfaces:**
- Consumes: `parseAmountToCents`, `formatCents` from `../../utils/money`.
- Produces: `export function centsFinalCountModel(expectedRemainingCents: number): FinalCountModel`

> **Execution note (money-critical, read first):** before writing this, open `screens/LocalSessionScreen.tsx:150-157` and confirm the CURRENT rules verbatim — how invalid entries are summed (does it `?? 0` or filter?), that `stacksMismatch = stacksTotalCents !== remainingCents` (exact), and that there is NO `hasAnyEntered` escape. The factory must reproduce them: `parse = parseAmountToCents` (null on invalid/neg/zero), `allowEmpty = false`, `isWithinTolerance = (d) => d === 0`, `format = formatCents`.

- [ ] **Step 1: Write the failing test** (append)

```ts
import { centsFinalCountModel } from '../finalCount';

describe('centsFinalCountModel (local integer-cents, exact)', () => {
  it('balances only on an exact cents match; blank/invalid ignored', () => {
    const m = centsFinalCountModel(10000); // ₪100.00 remaining
    expect(computeFinalCount({ a: '60', b: '40' }, m).isBalanced).toBe(true);   // 6000+4000
    expect(computeFinalCount({ a: '60', b: '40.01' }, m).isBalanced).toBe(false); // 1 agora over
    expect(computeFinalCount({ a: '60' }, m).short).toBe(true);
  });
  it('no entries is not balanced (must count or override)', () => {
    expect(computeFinalCount({}, centsFinalCountModel(10000)).isBalanced).toBe(false);
  });
  it('rejects negative / zero / junk via parseAmountToCents', () => {
    const m = centsFinalCountModel(5000);
    expect(computeFinalCount({ a: '-1', b: 'x', c: '0' }, m).hasAnyEntered).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`centsFinalCountModel` not exported). `cd apps/poker-mobile && npx jest src/local/__tests__/finalCount.test.ts`

- [ ] **Step 3: Implement** (add to `finalCount.ts`)

```ts
import { formatCents, parseAmountToCents } from '../utils/money';

/** Local games: integer cents, exact balance, no empty allowance — mirrors LocalSessionScreen. */
export function centsFinalCountModel(expectedRemainingCents: number): FinalCountModel {
  return {
    parse: (s) => parseAmountToCents(s), // null on invalid / negative / zero
    format: (n) => formatCents(n),
    expectedRemaining: expectedRemainingCents,
    allowEmpty: false,
    isWithinTolerance: (diff) => diff === 0,
    unitLabel: '',
  };
}
```

- [ ] **Step 4: Run → PASS.** `cd apps/poker-mobile && npx jest src/local/__tests__/finalCount.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/local/finalCount.ts apps/poker-mobile/src/local/__tests__/finalCount.test.ts
git commit -m "feat(final-count): cents model (exact, behavior-preserving for local)"
```

### Task 3: Wire `LocalSessionScreen` to the core (no behavior change)

**Files:**
- Modify: `apps/poker-mobile/src/screens/LocalSessionScreen.tsx:150-157` (replace inline balance math), and the button-disabled predicate at `:828`.

**Interfaces:**
- Consumes: `computeFinalCount`, `centsFinalCountModel` from `../local/finalCount`.

> **Execution note:** read `:131-157` and `:822-832` first. `totalPotCents` (`:131-134`) and the cash-out sum feeding `remainingCents` (`:155`) stay as-is; only the mismatch/entered math moves into the core. Keep `overrideArmed` and the auto-disarm effect (`:161-163`) exactly as they are.

- [ ] **Step 1: Add a characterization screen assertion** first (Task 4 writes the full screen test; here, keep the change guarded by that test). If executing Task 3 before Task 4, temporarily assert via a quick REPL of the two code paths, then rely on Task 4. (Preferred order: do Task 4's test skeleton first so this refactor is under test.)

- [ ] **Step 2: Replace the inline math.** Change `:150-157` from the inline `stacksTotalCents / remainingCents / stacksMismatch / mismatchCents` block to:

```ts
const remainingCents = totalPotCents - standings.reduce((s, p) => s + p.cashOutCents, 0);
const countModel = centsFinalCountModel(remainingCents);
const count = computeFinalCount(finalStacks, countModel);
// preserve the existing names the JSX below reads:
const stacksTotalCents = count.totalEntered;
const stacksMismatch = !count.isBalanced;       // exact-match semantics preserved (allowEmpty=false)
const mismatchCents = count.diff;                // signed, same as before (entered − remaining)
```

(Confirm the JSX indicator at `:771-792` still reads `stacksTotalCents` / `remainingCents` / `mismatchCents`; if it referenced `stacksMismatch`'s sign, use `count.over`/`count.short`.)

- [ ] **Step 3: Confirm the button predicate is unchanged.** `:828` stays `disabled={stacksMismatch && !overrideArmed}` — now `stacksMismatch = !count.isBalanced`, identical truth table to the old `stacksTotalCents !== remainingCents`.

- [ ] **Step 4: Run typecheck + existing tests.** `cd apps/poker-mobile && npx tsc --noEmit && npx jest`
Expected: PASS (no behavior change; existing suite green).

- [ ] **Step 5: Commit** (after Task 4's test is green — commit them together).

### Task 4: First end-game screen test — `LocalSessionScreen` Final Count

**Files:**
- Create: `apps/poker-mobile/src/screens/__tests__/LocalSessionScreen.finalcount.test.tsx`

**Interfaces:**
- Consumes: `@testing-library/react-native` (`render`, `screen`, `fireEvent`), the same mock pattern as `screens/__tests__/LoginScreen.test.tsx` (reanimated/moti/expo/storage mocked). Renders `LocalSessionScreen` inside the providers it needs (`LocalGamesContext` seeded with one Active cash game), navigation mocked.

> **Execution note:** read `screens/__tests__/LoginScreen.test.tsx` + `WelcomeScreen.test.tsx` for the exact provider/mocks harness (they already stub reanimated, moti, expo modules, storage). Reuse it. Seed one Active local cash game via a `LocalGamesContext` test provider (or mock `useLocalGames` to return `{ activeGame, endGame }`). The point of this test is to pin the END-GAME GATE behavior so PR B's server unification can't silently change local.

- [ ] **Step 1: Write the test** (behaviors, not implementation):

```tsx
// Pseudocode-level shape — fill in the project's standard mock header from LoginScreen.test.tsx.
describe('LocalSessionScreen — The Final Count gate', () => {
  it('disables "End Game & Settle" until stacks balance, and the indicator reads the running total', async () => {
    // render with one Active game: 2 players, ₪20 buy-in each ⇒ remaining ₪40 (4000 cents)
    // open the Final Count (press "End Game")
    // assert button disabled; enter 20 + 20; assert indicator "Counted ₪40 of ₪40"; assert button enabled
  });
  it('the override unblocks settling on an unbalanced count', async () => {
    // enter 20 + 10 (short); button disabled; toggle "End anyway with an unbalanced count"; button enabled
  });
  it('settling calls endGame with per-player cents and navigates to the summary', async () => {
    // mock endGame; enter balancing stacks; press "End Game & Settle";
    // expect endGame called with [{ playerId, amountCents }]; expect navigation.replace('LocalSessionSummary', ...)
  });
});
```

- [ ] **Step 2: Run → confirm it exercises the real screen and passes against the Task 3 refactor.** `cd apps/poker-mobile && npx jest src/screens/__tests__/LocalSessionScreen.finalcount.test.tsx`
Expected: PASS (Task 3 preserved behavior). If the harness can't mount the screen, fall back to testing the extracted core + a thin render of the indicator subtree — but prefer the full screen.

- [ ] **Step 3: Full gate.** `cd apps/poker-mobile && npx tsc --noEmit && npx jest`
Expected: all green.

- [ ] **Step 4: Commit Tasks 3+4 together**

```bash
git add apps/poker-mobile/src/screens/LocalSessionScreen.tsx apps/poker-mobile/src/screens/__tests__/LocalSessionScreen.finalcount.test.tsx
git commit -m "refactor(local-session): Final Count via shared core + first end-game screen test"
```

- [ ] **Step 5: Open PR A**, adversarial review (money-critical: verify the truth table is identical — enumerate {no entries, exact, +1, −1, +override} for local and confirm enabled/disabled matches pre-refactor), report, STOP for owner merge.

---

## PR B — decimal/chips adapter + shared `FinalCountSheet` + adopt in both screens

### Task 5: Decimal/chips model factory (behavior-preserving for server)

**Files:** Modify `local/finalCount.ts` (add `decimalFinalCountModel`); Test `local/__tests__/finalCount.test.ts` (add describe).

**Interfaces:**
- Produces:
  ```ts
  export function decimalFinalCountModel(opts: {
    expectedRemainingUnits: number; // dollars, OR chips if useChips (already scaled by the screen)
    useChips: boolean;
    symbol: string;                 // sym for money formatting
  }): FinalCountModel;
  ```

> **Execution note (money-critical):** read `SessionScreen.tsx:84-86` (`toMoney`), `:1729-1745` (balance IIFE), `:1742-1744` (`fmt`). The factory MUST reproduce: `parse = (s) => { const n = parseFloat(s); return Number.isFinite(n) && n >= 0 ? n : null; }`; `allowEmpty = true`; `isWithinTolerance = (d) => Math.abs(d) < 0.5` (strict `<`, matching `:1740`); `format` = exactly the current `fmt` (chips → `String(Math.round(n))`; money → `${symbol}${n.toFixed(2)}` — confirm the real precision used). The screen still owns `toMoney` for building the settle payload (decimal `amount`), and computes `expectedRemainingUnits` (`expectedInUnits` at `:1732-1734`) to pass in — keeping the factory pure.

- [ ] Steps: RED test (money tolerance 0.5, chips rounding, empty=balanced) → implement → GREEN → commit. Test cases:
  - `decimalFinalCountModel({ expectedRemainingUnits: 100, useChips:false, symbol:'₪' })`: entries `50 + 50.3` → diff `0.3` → balanced (`< 0.5`); `50 + 50.9` → diff `0.9` → not balanced.
  - empty entries → balanced (allowEmpty true).
  - chips mode: `format(1000.4)` → `'1000'`.

### Task 6: Shared `FinalCountSheet` component (canonical copy, once)

**Files:** Create `apps/poker-mobile/src/components/FinalCountSheet.tsx`; Test `apps/poker-mobile/src/components/__tests__/FinalCountSheet.test.tsx`.

**Interfaces:**
- Produces:
  ```ts
  export interface FinalCountRow {
    id: string; name: string;
    kind: 'input' | 'busted' | 'cashed'; // busted → "Busted · {sym}0" static; cashed → static label, no input
    cashedLabel?: string;                 // for kind==='cashed' (server mid-game cash-outs)
  }
  export interface FinalCountSheetProps {
    rows: FinalCountRow[];
    entered: Record<string, string>;
    onChangeEntry(id: string, value: string): void;
    model: FinalCountModel;              // drives format + indicator unit
    state: FinalCountState;              // from computeFinalCount(entered, model)
    overrideOn: boolean;
    onToggleOverride(v: boolean): void;
    subtitleUnit: 'chips' | 'cash';      // server swaps; local passes 'chips'
    chipsToggle?: React.ReactNode;       // server-only chips/money segmented control; omitted → not rendered
    onKeepPlaying(): void;
    onSettle(): void;
  }
  export default function FinalCountSheet(props: FinalCountSheetProps): JSX.Element;
  ```
  `settleDisabled = !props.state.isBalanced && !props.overrideOn` is computed inside.

> **Execution note:** the JSX/styles are **lifted verbatim** from `LocalSessionScreen.tsx:731-835` (the more canonical, simpler copy), then parameterized: the subtitle word from `subtitleUnit`, the indicator string from `model.format(state.totalEntered)` / `model.format(state.expected)` + `model.unitLabel`, and the optional `chipsToggle`/`cashed` rows to accommodate the server. Copy strings must match the Global Constraints table exactly. Component test: renders rows, disables settle when `state.isBalanced=false && !overrideOn`, enables when override on, calls `onSettle`/`onKeepPlaying`.

- [ ] Steps: RED component test → implement (lift + parameterize) → GREEN → commit.

### Task 7: Adopt `FinalCountSheet` in `LocalSessionScreen`

**Files:** Modify `screens/LocalSessionScreen.tsx:731-835` (replace inline sheet markup with `<FinalCountSheet .../>`); keep `LocalSessionScreen.finalcount.test.tsx` green (it now exercises the shared component through the screen).

- [ ] Steps: swap markup → `npx tsc --noEmit && npx jest` (the Task 4 screen test must still pass unchanged) → commit.

### Task 8: Adopt `FinalCountSheet` in `SessionScreen` + server screen test

**Files:** Modify `screens/SessionScreen.tsx:1666-1823` (replace Step-2 inline sheet with `<FinalCountSheet .../>`, feeding `decimalFinalCountModel` + `computeFinalCount`); keep Step-1/Quick-End (`:1602-1663`) and inline Game-Over (Step 3) as the screen shell. Create `screens/__tests__/SessionScreen.finalcount.test.tsx`.

> **Execution note (highest risk):** enumerate the server truth table BEFORE and AFTER — {no entries (balanced via allowEmpty), within 0.5, outside 0.5, chips-toggle on/off, already-cashed excluded, override}. The `cashed` rows (`:1708-1709`) map to `FinalCountRow.kind==='cashed'`; `expectedRemaining` must still subtract already-cashed (server computes it and passes in). `handleEndSession` (`:482-521`) is unchanged — it still builds decimal `FinalStackItem[]` via `toMoney` and calls the API. The shared sheet only replaces the count UI + the enabled/disabled gate.

- [ ] Steps: RED server screen test (mirrors Task 4 for decimal/chips + cashed-out exclusion + 0.5 tolerance) → swap markup → GREEN (`tsc` + `jest`) → adversarial review (money-critical truth-table diff) → commit → open PR B → STOP for owner merge.

---

## PR C — shared results rendering (sets up 2.2)

### Task 9: `GameResults` component (results + settlements, once)

**Files:** Create `apps/poker-mobile/src/components/GameResults.tsx`; Test `components/__tests__/GameResults.test.tsx`.

**Interfaces:**
- Produces: a presentational component taking a normalized `{ rows: {name, netText, positive, medal?}[]; settlements: {from,to,amountText}[]; heading; potLabel; potText; meta }` — lifted from `LocalSessionSummaryScreen.tsx:195-317` (RESULTS + CASH SETTLEMENTS), currency via `formatCents`/`formatMoney` at the call site (no hardcoded ₪).

> **Execution note:** this is presentational only. Keep `settleGame`/`tournamentResult` computation in `LocalSessionSummaryScreen` and the server balance calls in `SessionScreen`; pass normalized rows in. This is the seam 2.2 (Results Card 2.0) replaces with the branded card.

- [ ] Steps: RED component test → implement (lift + normalize) → GREEN → commit.

### Task 10: Adopt in `LocalSessionSummaryScreen`

**Files:** Modify `screens/LocalSessionSummaryScreen.tsx:195-317` → `<GameResults .../>`.

- [ ] Steps: swap → `tsc` + `jest` (add a light summary render test asserting the results/settlement rows) → commit.

### Task 11: Adopt in `SessionScreen` Game-Over step

**Files:** Modify `screens/SessionScreen.tsx` Step-3 inline results → `<GameResults .../>`.

- [ ] Steps: swap → `tsc` + `jest` → adversarial review → commit → open PR C → STOP for owner merge. (2.2 depends on this landing.)

---

## Self-Review

**1. Spec coverage** (master-plan 2.1 = "three consumers, three PRs; two Final Counts are divergent … unification behind an adapter": (a) local module + first end-game screen tests, (b) server adaptation, (c) summary-screen adoption):
- (a) → PR A (Tasks 1–4): local module ✓, cents adapter ✓, first end-game screen test ✓.
- (b) → PR B (Tasks 5–8): decimal adapter ✓, shared component ✓, server adaptation ✓.
- (c) → PR C (Tasks 9–11): summary-screen adoption of shared results ✓ (2.2/2.4 dependency satisfied).
- Divergences from the exploration all have a home: money model + tolerance → the two model factories (Tasks 2, 5); empty-allowance → `allowEmpty`; validation → `parse`; cashed-out eligibility → `FinalCountRow.kind` (Task 6/8); flow shape (Quick-End, inline Game-Over) → kept as screen shells.

**2. Placeholder scan:** No "TBD/handle edge cases". PR B/PR C give exact files, interfaces, first-test behaviors, and cite the exact lines whose markup is lifted verbatim — deliberately not re-inventing existing JSX. Flagged explicitly as the chosen altitude for a money-critical lift.

**3. Type consistency:** `FinalCountModel` / `FinalCountState` / `computeFinalCount` names identical across Tasks 1–8. `centsFinalCountModel(number)` and `decimalFinalCountModel({expectedRemainingUnits,useChips,symbol})` signatures stable. `FinalCountSheetProps.state`/`model` consume Task 1's exact types. Screen JSX keeps the existing local variable names (`stacksTotalCents`, `remainingCents`, `mismatchCents`) so the indicator markup needs no rename in Task 3.

**Risk register (from exploration §7):** (1) server 0.5-**chip** tolerance is far looser than 0.5 dollars — PRESERVED, not "fixed", in 2.1 (Task 5 reproduces `< 0.5`); any convergence is a separate owner decision. (2) chips rounding vs tolerance: Task 5 reproduces the exact `fmt`; the adversarial gate in Task 8 checks a "balanced display can't coexist with a non-zero settle delta" case and documents it if it already can today. (3) input eligibility (server excludes cashed, local includes all): encoded in `FinalCountRow.kind`, verified in Task 8's truth table.
