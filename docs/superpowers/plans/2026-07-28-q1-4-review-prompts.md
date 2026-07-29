# Q1.4 Review Prompts Implementation Plan

> ## ⛔ SUPERSEDED — DO NOT EXECUTE THIS PLAN
>
> **Owner decision 2026-07-29.** Tasks 6 and 7 below build a sentiment sheet
> (`SentimentSheet.tsx`), a surface hook (`useReviewSurface.ts`), and an occlusion-geometry
> subsystem. **All of that was built, reviewed by a 5-agent critic fleet, and deleted.** Following
> these steps would reconstruct two blockers and re-introduce App Store Guideline 1.1.7 exposure.
>
> What ships instead: `requestNativeReview()` called **directly** at a qualifying moment, no sheet.
> Read `docs/superpowers/specs/2026-07-28-review-prompts-design.md` **§0** for the reasoning, and
> `CLAUDE.md` → "Review prompts" for the shipped behaviour.
>
> Kept for provenance, and because Tasks 1–5 (pure rules, store, flag, native wrapper,
> `isCelebrating`) describe work that did survive — though even those changed: the constants are
> now pinned to literals, the moment vocabulary dropped to three kinds, streak milestones use a
> ladder, and `lastSentiment` is gone.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ask engaged users whether they are enjoying T Poker after a genuinely positive moment, routing happy users to the native store review and unhappy users to a prefilled support email — without ever nagging, interrupting a task, or covering a settlement list.

**Architecture:** All decision-making lives in one pure, zero-import module (`features/reviews/logic/reviewPromptLogic.ts`) that is fully unit-tested without rendering anything. A single context host owns the counters and renders the sheet; screens only report what happened and where their protected content is. The sheet is content inside the existing `components/BottomSheet` primitive — no new sheet chrome.

**Tech Stack:** Expo SDK 54 · React Native · TypeScript · Jest (`jest-expo`) · AsyncStorage · `expo-store-review` (new dependency)

## Global Constraints

- **Spec of record:** `docs/superpowers/specs/2026-07-28-review-prompts-design.md`. Read it before Task 1.
- **Expo docs:** per `apps/poker-mobile/AGENTS.md`, verify every `expo-store-review` API call against https://docs.expo.dev/versions/v54.0.0/sdk/storereview/ before writing it. Do not write the call from memory.
- **Day keys are LOCAL.** `toISOString().slice(0, 10)` is banned repo-wide by `utils/__tests__/dayKeyBan.test.ts`. This slice uses epoch milliseconds, not day keys, so the ban should not be triggered — if you find yourself formatting a date, stop and reconsider.
- **`jest.mock(..., { virtual: true })` is banned** by `utils/__tests__/jestMockHygieneBan.test.ts`. `expo-store-review` must be a real dependency.
- **Never hardcode hex or font sizes.** Use `theme/colors.ts`, `theme/typography.ts`, `theme/spacing.ts`, `theme/radii.ts`.
- **Web-safe dialogs only.** `Alert.alert` is a no-op on web.
- **Zero gold on either answer button.** The two sentiment buttons must be byte-identical in style. See spec §7 — this is a correctness requirement, not taste.
- **No copy anywhere may promise that a rating dialog will appear.** iOS caps `requestReview` at ~3/year and may silently no-op.
- **The win/loss streak must remain unrepresentable** in `ReviewSignals`. Only the study-day streak qualifies.
- **Jest `testMatch` is an allowlist** (`apps/poker-mobile/jest.config.js:4-18`). `**/src/features/**/__tests__/**/*.test.ts?(x)` and `**/src/config/__tests__/**/*.test.ts` are covered. A test placed outside those globs silently does not run — after adding the first test, confirm the count went up.
- **All commands run from `apps/poker-mobile`** unless stated otherwise.

---

## File Structure

**Create:**
| File | Responsibility |
|---|---|
| `src/features/reviews/logic/reviewPromptLogic.ts` | All rules. Pure, zero imports, `nowMs` injected. |
| `src/features/reviews/logic/__tests__/reviewPromptLogic.test.ts` | Eligibility matrix, geometry, honesty pins. |
| `src/features/reviews/data/reviewPromptStore.ts` | `tpoker.reviewPrompt.v1`. Fail-safe. |
| `src/features/reviews/data/__tests__/reviewPromptStore.test.ts` | Corrupt payload, stamp-once, write safety. |
| `src/features/reviews/nativeReview.ts` | `expo-store-review` behind a native gate; never throws. |
| `src/features/reviews/__tests__/nativeReview.test.ts` | Unavailable + throwing paths. |
| `src/features/reviews/state/ReviewPromptContext.tsx` | Host: counters, decision, renders the sheet. |
| `src/features/reviews/state/useReviewSurface.ts` | Screen-facing hook; does the rect arithmetic. |
| `src/features/reviews/ui/SentimentSheet.tsx` | Direction-A content inside `BottomSheet`. |
| `src/config/support.ts` | `SUPPORT_EMAIL` + `supportMailto()`. |
| `src/config/__tests__/support.test.ts` | Constant + mailto encoding. |

**Modify:** `src/config/features.ts` · `src/config/__tests__/features.test.ts` · `src/config/__tests__/features.prodFlags.test.ts` · `src/utils/analytics.ts` · `App.tsx` · `src/features/engagement/state/EngagementContext.tsx` · `src/features/study/ui/SpotTrainerScreen.tsx` · `src/screens/LocalSessionSummaryScreen.tsx` · `src/screens/SessionScreen.tsx` · `src/screens/ProfileScreen.tsx` · `src/features/premium/ui/PaywallScreen.tsx` · `package.json`

---

### Task 1: Pure rules module

**Files:**
- Create: `src/features/reviews/logic/reviewPromptLogic.ts`
- Test: `src/features/reviews/logic/__tests__/reviewPromptLogic.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ReviewMomentKind`, `REVIEW_MOMENT_KINDS`, `ReviewPromptState`, `ReviewSignals`, `EligibilityReason`, `EligibilityResult`, `Region`, `RegionState`, `PresentInput`, `DwellSurface`, `DWELL_MS`, `SHEET_OCCLUSION_H`, `INSTALL_AGE_FLOOR_MS`, `MIN_QUALIFYING_MOMENTS`, `PROMPT_COOLDOWN_MS`, `evaluateReviewPrompt()`, `regionState()`, `canPresentNow()`.

- [ ] **Step 1: Write the failing test**

Create `src/features/reviews/logic/__tests__/reviewPromptLogic.test.ts`:

```ts
import {
  DWELL_MS,
  INSTALL_AGE_FLOOR_MS,
  MIN_QUALIFYING_MOMENTS,
  PROMPT_COOLDOWN_MS,
  REVIEW_MOMENT_KINDS,
  SHEET_OCCLUSION_H,
  canPresentNow,
  evaluateReviewPrompt,
  regionState,
  type ReviewPromptState,
  type ReviewSignals,
} from '../reviewPromptLogic';

const DAY = 24 * 60 * 60 * 1000;
// Fixed local-component clock so expectations hold in any timezone.
const NOW = new Date(2026, 6, 28, 12, 0, 0).getTime();

function state(over: Partial<ReviewPromptState> = {}): ReviewPromptState {
  return {
    installedAt: NOW - 30 * DAY,
    moments: MIN_QUALIFYING_MOMENTS,
    streakMilestoneHigh: 0,
    lastPromptedAt: null,
    promptedVersions: [],
    lastSentiment: null,
    ...over,
  };
}

function signals(over: Partial<ReviewSignals> = {}): ReviewSignals {
  return { nowMs: NOW, appVersion: '1.2.0', ...over };
}

describe('evaluateReviewPrompt — eligibility', () => {
  it('is eligible when every rule passes', () => {
    expect(evaluateReviewPrompt(state(), signals())).toEqual({ eligible: true, reason: 'ok' });
  });

  it('rejects a too-new install with reason too_new', () => {
    const r = evaluateReviewPrompt(state({ installedAt: NOW - 1 * DAY }), signals());
    expect(r).toEqual({ eligible: false, reason: 'too_new' });
  });

  it('accepts exactly at the install-age floor (boundary)', () => {
    const r = evaluateReviewPrompt(state({ installedAt: NOW - INSTALL_AGE_FLOOR_MS }), signals());
    expect(r.eligible).toBe(true);
  });

  it('rejects too few moments with reason too_few_moments', () => {
    const r = evaluateReviewPrompt(state({ moments: MIN_QUALIFYING_MOMENTS - 1 }), signals());
    expect(r).toEqual({ eligible: false, reason: 'too_few_moments' });
  });

  it('accepts exactly at the moment threshold (boundary)', () => {
    expect(evaluateReviewPrompt(state({ moments: MIN_QUALIFYING_MOMENTS }), signals()).eligible).toBe(true);
  });

  it('rejects a version already prompted with reason already_this_version', () => {
    const r = evaluateReviewPrompt(state({ promptedVersions: ['1.2.0'] }), signals());
    expect(r).toEqual({ eligible: false, reason: 'already_this_version' });
  });

  it('allows a different version once the cooldown has passed', () => {
    const r = evaluateReviewPrompt(
      state({ promptedVersions: ['1.1.1'], lastPromptedAt: NOW - PROMPT_COOLDOWN_MS }),
      signals(),
    );
    expect(r.eligible).toBe(true);
  });

  it('rejects inside the cooldown with reason cooldown', () => {
    const r = evaluateReviewPrompt(
      state({ promptedVersions: ['1.1.1'], lastPromptedAt: NOW - 1 * DAY }),
      signals(),
    );
    expect(r).toEqual({ eligible: false, reason: 'cooldown' });
  });

  it('suppresses an unhappy user for the rest of the cooldown', () => {
    const r = evaluateReviewPrompt(
      state({ promptedVersions: ['1.1.1'], lastPromptedAt: NOW - 10 * DAY, lastSentiment: 'unhappy' }),
      signals(),
    );
    expect(r.eligible).toBe(false);
  });
});

describe('regionState — settlement geometry', () => {
  const viewportH = 800;
  const sheetH = SHEET_OCCLUSION_H;
  const sheetTop = viewportH - sheetH;

  it('reports a block sitting entirely above the sheet as fully visible and not intersecting', () => {
    expect(regionState({ top: 100, bottom: sheetTop - 10, viewportH, sheetH })).toEqual({
      fullyVisibleAboveSheet: true,
      intersectsSheet: false,
    });
  });

  it('reports a block straddling the sheet edge as intersecting', () => {
    const r = regionState({ top: sheetTop - 20, bottom: sheetTop + 20, viewportH, sheetH });
    expect(r.intersectsSheet).toBe(true);
    expect(r.fullyVisibleAboveSheet).toBe(false);
  });

  it('does not treat a block scrolled off the top as intersecting', () => {
    expect(regionState({ top: -400, bottom: -100, viewportH, sheetH })).toEqual({
      fullyVisibleAboveSheet: false,
      intersectsSheet: false,
    });
  });

  it('does not treat a block below the fold as visible', () => {
    const r = regionState({ top: viewportH + 50, bottom: viewportH + 300, viewportH, sheetH });
    expect(r.fullyVisibleAboveSheet).toBe(false);
    expect(r.intersectsSheet).toBe(false);
  });

  it('handles a short summary where the block sits high on screen', () => {
    expect(regionState({ top: 40, bottom: 240, viewportH, sheetH }).fullyVisibleAboveSheet).toBe(true);
  });
});

describe('canPresentNow', () => {
  const base = {
    dwellElapsedMs: DWELL_MS.game_summary,
    requiredDwellMs: DWELL_MS.game_summary,
    isCelebrating: false,
    protectedRegion: { seen: true, intersectsSheet: false },
  };

  it('presents when dwell is met, nothing is celebrating, and the region is seen and clear', () => {
    expect(canPresentNow(base)).toBe(true);
  });

  it('blocks before the dwell elapses', () => {
    expect(canPresentNow({ ...base, dwellElapsedMs: DWELL_MS.game_summary - 1 })).toBe(false);
  });

  it('blocks while a celebration is playing', () => {
    expect(canPresentNow({ ...base, isCelebrating: true })).toBe(false);
  });

  it('blocks when the protected region has never been seen', () => {
    expect(canPresentNow({ ...base, protectedRegion: { seen: false, intersectsSheet: false } })).toBe(false);
  });

  it('blocks when the protected region would be covered right now', () => {
    expect(canPresentNow({ ...base, protectedRegion: { seen: true, intersectsSheet: true } })).toBe(false);
  });

  it('needs only dwell on a surface with no protected region', () => {
    expect(canPresentNow({
      dwellElapsedMs: DWELL_MS.drill_results,
      requiredDwellMs: DWELL_MS.drill_results,
      isCelebrating: false,
      protectedRegion: null,
    })).toBe(true);
  });
});

describe('honesty pins — do not weaken', () => {
  it('produces exactly the four approved moment kinds', () => {
    expect([...REVIEW_MOMENT_KINDS].sort()).toEqual([
      'achievement_dismissed',
      'drill_strong',
      'game_summary',
      'streak_milestone',
    ]);
  });

  it('carries no win/loss streak signal — only the study-day streak may qualify', () => {
    // The server win/loss streak can be NEGATIVE ("3-game loss streak"). Asking for a rating
    // mid-losing-streak is the exact failure this pin exists to prevent. Making it
    // unrepresentable beats documenting it.
    const keys = Object.keys(signals()).sort();
    expect(keys).toEqual(['appVersion', 'nowMs']);
  });

  it('gives the game summary a longer dwell than drill results', () => {
    expect(DWELL_MS.game_summary).toBeGreaterThan(DWELL_MS.drill_results);
  });

  it('clears the ~5.04s game-end celebration on the summary surface', () => {
    expect(DWELL_MS.game_summary).toBeGreaterThan(5040);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/reviews/logic/__tests__/reviewPromptLogic.test.ts`
Expected: FAIL — `Cannot find module '../reviewPromptLogic'`.

- [ ] **Step 3: Write the implementation**

Create `src/features/reviews/logic/reviewPromptLogic.ts`:

```ts
/**
 * Review-prompt rules — PURE. Zero imports, `nowMs` injected, no I/O, no React.
 *
 * Consumed by features/reviews/state/ReviewPromptContext.tsx. Everything hard to verify by hand
 * lives here so it can be verified by test instead: iOS caps the native dialog at ~3/year and may
 * silently no-op, so we can never confirm our rate limiting by observation.
 *
 * HONESTY CONSTRAINTS (pinned in __tests__/reviewPromptLogic.test.ts):
 *  - The four moment kinds below are the complete producible set.
 *  - ReviewSignals carries NO win/loss streak. Only the STUDY-day streak qualifies; the server
 *    win/loss streak can be negative, and asking for a rating during a losing run is the exact
 *    failure mode this rule prevents. Unrepresentable beats documented.
 *  - Nothing here promises the native dialog will appear.
 */

export type ReviewMomentKind =
  | 'achievement_dismissed'
  | 'drill_strong'
  | 'game_summary'
  | 'streak_milestone';

export const REVIEW_MOMENT_KINDS: readonly ReviewMomentKind[] = [
  'achievement_dismissed',
  'drill_strong',
  'game_summary',
  'streak_milestone',
] as const;

export interface ReviewPromptState {
  /** Epoch ms, stamped once on first load. We do not know a pre-upgrade user's real install date. */
  installedAt: number;
  /** Monotonic count of qualifying moments. */
  moments: number;
  /** Highest study-streak milestone already counted — a streak is a state, not an event. */
  streakMilestoneHigh: number;
  /** Epoch ms the sheet was last SHOWN (not answered). */
  lastPromptedAt: number | null;
  /** App versions in which the sheet was shown. */
  promptedVersions: string[];
  lastSentiment: 'happy' | 'unhappy' | null;
}

export interface ReviewSignals {
  nowMs: number;
  appVersion: string;
}

export type EligibilityReason =
  | 'ok'
  | 'too_new'
  | 'too_few_moments'
  | 'already_this_version'
  | 'cooldown';

export interface EligibilityResult {
  eligible: boolean;
  reason: EligibilityReason;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const INSTALL_AGE_FLOOR_MS = 3 * DAY_MS;
export const MIN_QUALIFYING_MOMENTS = 3;
export const PROMPT_COOLDOWN_MS = 90 * DAY_MS;

/** Conservative height of the sheet's occlusion band, in px. */
export const SHEET_OCCLUSION_H = 240;

export const DWELL_MS = {
  /** Game-end Celebration runs ~5.04s — clear it, then leave reading time on a money screen. */
  game_summary: 7000,
  /** Study success Celebration runs ~1.5s. */
  drill_results: 3000,
} as const;

export type DwellSurface = keyof typeof DWELL_MS;

/**
 * Reasons are ordered cheapest-and-most-fundamental first, so the reported reason is the most
 * useful one. Tests assert the reason, not just the boolean — a test that only checks `false`
 * passes for the wrong cause and keeps passing after the logic breaks.
 */
export function evaluateReviewPrompt(state: ReviewPromptState, signals: ReviewSignals): EligibilityResult {
  if (signals.nowMs - state.installedAt < INSTALL_AGE_FLOOR_MS) {
    return { eligible: false, reason: 'too_new' };
  }
  if (state.moments < MIN_QUALIFYING_MOMENTS) {
    return { eligible: false, reason: 'too_few_moments' };
  }
  if (state.promptedVersions.includes(signals.appVersion)) {
    return { eligible: false, reason: 'already_this_version' };
  }
  if (state.lastPromptedAt !== null && signals.nowMs - state.lastPromptedAt < PROMPT_COOLDOWN_MS) {
    return { eligible: false, reason: 'cooldown' };
  }
  return { eligible: true, reason: 'ok' };
}

export interface Region {
  /** Viewport-space Y of the protected block's top edge (may be negative once scrolled past). */
  top: number;
  bottom: number;
  viewportH: number;
  sheetH: number;
}

export interface RegionState {
  fullyVisibleAboveSheet: boolean;
  intersectsSheet: boolean;
}

/**
 * A dwell timer cannot know whether the user scrolled. This does: it reports both whether the
 * protected block has ever been fully readable above the sheet, and whether the sheet would
 * cover it right now.
 */
export function regionState({ top, bottom, viewportH, sheetH }: Region): RegionState {
  const sheetTop = viewportH - sheetH;
  return {
    fullyVisibleAboveSheet: top >= 0 && bottom <= sheetTop,
    intersectsSheet: bottom > sheetTop && top < viewportH,
  };
}

export interface PresentInput {
  dwellElapsedMs: number;
  requiredDwellMs: number;
  isCelebrating: boolean;
  /** `null` on surfaces with nothing to protect (drill results). */
  protectedRegion: { seen: boolean; intersectsSheet: boolean } | null;
}

export function canPresentNow(input: PresentInput): boolean {
  if (input.dwellElapsedMs < input.requiredDwellMs) return false;
  if (input.isCelebrating) return false;
  if (input.protectedRegion === null) return true;
  return input.protectedRegion.seen && !input.protectedRegion.intersectsSheet;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/reviews/logic/__tests__/reviewPromptLogic.test.ts`
Expected: PASS, 24 tests.

- [ ] **Step 5: Confirm the test actually ran (testMatch allowlist check)**

Run: `npx jest --listTests | grep reviewPromptLogic`
Expected: the file path is listed. If empty, the glob is not matching — fix `jest.config.js` before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/features/reviews/logic
git commit -m "feat(reviews): pure review-prompt rules — eligibility, dwell, settlement geometry"
```

---

### Task 2: Persistence store

**Files:**
- Create: `src/features/reviews/data/reviewPromptStore.ts`
- Test: `src/features/reviews/data/__tests__/reviewPromptStore.test.ts`

**Interfaces:**
- Consumes: `ReviewPromptState` from Task 1.
- Produces: `REVIEW_PROMPT_KEY`, `defaultReviewPromptState(nowMs)`, `loadReviewPromptState(nowMs)`, `saveReviewPromptState(state)`.

- [ ] **Step 1: Write the failing test**

Create `src/features/reviews/data/__tests__/reviewPromptStore.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  REVIEW_PROMPT_KEY,
  defaultReviewPromptState,
  loadReviewPromptState,
  saveReviewPromptState,
} from '../reviewPromptStore';

jest.mock('@react-native-async-storage/async-storage', () => {
  const mem = new Map<string, string>();
  return {
    getItem: jest.fn(async (k: string) => (mem.has(k) ? mem.get(k)! : null)),
    setItem: jest.fn(async (k: string, v: string) => { mem.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mem.delete(k); }),
    __mem: mem,
  };
});

const mem = (AsyncStorage as unknown as { __mem: Map<string, string> }).__mem;
const NOW = new Date(2026, 6, 28, 12, 0, 0).getTime();

beforeEach(() => {
  mem.clear();
  jest.clearAllMocks();
});

describe('reviewPromptStore', () => {
  it('stamps installedAt on the first load and persists it', async () => {
    const s = await loadReviewPromptState(NOW);
    expect(s.installedAt).toBe(NOW);
    expect(mem.get(REVIEW_PROMPT_KEY)).toContain(String(NOW));
  });

  it('does not re-stamp installedAt on a later load', async () => {
    await loadReviewPromptState(NOW);
    const later = await loadReviewPromptState(NOW + 10_000);
    expect(later.installedAt).toBe(NOW);
  });

  it('falls back to defaults on a corrupt payload without throwing', async () => {
    mem.set(REVIEW_PROMPT_KEY, '{not json');
    const s = await loadReviewPromptState(NOW);
    expect(s).toEqual(defaultReviewPromptState(NOW));
  });

  it('falls back to defaults when fields have the wrong types', async () => {
    mem.set(REVIEW_PROMPT_KEY, JSON.stringify({ installedAt: 'yesterday', moments: null }));
    const s = await loadReviewPromptState(NOW);
    expect(s).toEqual(defaultReviewPromptState(NOW));
  });

  it('round-trips a saved state', async () => {
    const s = { ...defaultReviewPromptState(NOW), moments: 4, promptedVersions: ['1.2.0'] };
    await saveReviewPromptState(s);
    expect(await loadReviewPromptState(NOW + 1)).toEqual(s);
  });

  it('never throws when the write fails', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(saveReviewPromptState(defaultReviewPromptState(NOW))).resolves.toBeUndefined();
  });

  it('never throws when the read fails', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    await expect(loadReviewPromptState(NOW)).resolves.toEqual(defaultReviewPromptState(NOW));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/reviews/data`
Expected: FAIL — `Cannot find module '../reviewPromptStore'`.

- [ ] **Step 3: Write the implementation**

Create `src/features/reviews/data/reviewPromptStore.ts`:

```ts
/**
 * Thin AsyncStorage wrapper for the review-prompt state. FAIL-SAFE by design: a corrupt or
 * partially-written payload loads as defaults, and writes never throw. A rating prompt is never
 * worth crashing a session over.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReviewPromptState } from '../logic/reviewPromptLogic';

export const REVIEW_PROMPT_KEY = 'tpoker.reviewPrompt.v1';

export function defaultReviewPromptState(nowMs: number): ReviewPromptState {
  return {
    installedAt: nowMs,
    moments: 0,
    streakMilestoneHigh: 0,
    lastPromptedAt: null,
    promptedVersions: [],
    lastSentiment: null,
  };
}

function isValid(v: unknown): v is ReviewPromptState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.installedAt === 'number' &&
    Number.isFinite(s.installedAt) &&
    typeof s.moments === 'number' &&
    typeof s.streakMilestoneHigh === 'number' &&
    (s.lastPromptedAt === null || typeof s.lastPromptedAt === 'number') &&
    Array.isArray(s.promptedVersions) &&
    s.promptedVersions.every(x => typeof x === 'string') &&
    (s.lastSentiment === null || s.lastSentiment === 'happy' || s.lastSentiment === 'unhappy')
  );
}

/**
 * Loads the state, stamping `installedAt` exactly once. For a user upgrading from an earlier
 * version this reads as "installed now" — we do not know their real install date and do not
 * pretend to. The ≥3-qualifying-moments rule is the real engagement gate.
 */
export async function loadReviewPromptState(nowMs: number): Promise<ReviewPromptState> {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_PROMPT_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) return parsed;
    }
  } catch {
    // fall through to defaults
  }
  const fresh = defaultReviewPromptState(nowMs);
  await saveReviewPromptState(fresh);
  return fresh;
}

export async function saveReviewPromptState(state: ReviewPromptState): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_PROMPT_KEY, JSON.stringify(state));
  } catch {
    // best-effort; never throw into the UI
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/reviews/data`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/reviews/data
git commit -m "feat(reviews): fail-safe review-prompt store with stamp-once installedAt"
```

---

### Task 3: Flag, analytics events, and the support-email constant

**Files:**
- Create: `src/config/support.ts`, `src/config/__tests__/support.test.ts`
- Modify: `src/config/features.ts`, `src/config/__tests__/features.test.ts:52-68`, `src/config/__tests__/features.prodFlags.test.ts`, `src/utils/analytics.ts:76-78`, `src/screens/ProfileScreen.tsx:604`, `src/features/premium/ui/PaywallScreen.tsx:305`

**Interfaces:**
- Produces: `SUPPORT_EMAIL`, `supportMailto(subject, body?)`, feature flag `'reviews'`, analytics events `review_prompt_shown` / `review_sentiment` / `review_native_requested` / `review_feedback_opened` / `review_prompt_dismissed`.

- [ ] **Step 1: Write the failing test**

Create `src/config/__tests__/support.test.ts`:

```ts
import { SUPPORT_EMAIL, supportMailto } from '../support';

describe('support contact', () => {
  it('exposes the single support address', () => {
    expect(SUPPORT_EMAIL).toBe('truestorylabs@gmail.com');
  });

  it('builds a mailto with an encoded subject', () => {
    expect(supportMailto('T Poker support')).toBe(
      'mailto:truestorylabs@gmail.com?subject=T%20Poker%20support',
    );
  });

  it('appends an encoded body when given one', () => {
    expect(supportMailto('Feedback', 'Line one')).toBe(
      'mailto:truestorylabs@gmail.com?subject=Feedback&body=Line%20one',
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/config/__tests__/support.test.ts`
Expected: FAIL — `Cannot find module '../support'`.

- [ ] **Step 3: Create the constant**

Create `src/config/support.ts`:

```ts
/**
 * The one support address. Previously duplicated across ProfileScreen, PaywallScreen and the
 * shipped policy HTML; the TypeScript call sites now share this constant.
 *
 * NOTE: `public/*.html` deliberately keeps its literal — those files are shipped assets pinned by
 * features/premium/__tests__/legalSurfaces.test.ts, and templatising them would break that pin
 * for no benefit.
 */
export const SUPPORT_EMAIL = 'truestorylabs@gmail.com';

export function supportMailto(subject: string, body?: string): string {
  const parts = [`subject=${encodeURIComponent(subject)}`];
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${SUPPORT_EMAIL}?${parts.join('&')}`;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest src/config/__tests__/support.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the feature flag**

In `src/config/features.ts`, change line 30 from `| 'analytics';` to:

```ts
  | 'analytics' // Wave 0.2 — PostHog EU dispatch (kill-switch; consent-gated inside utils/analytics)
  | 'reviews';  // Q1.4 — sentiment gate → native store review / prefilled support mail
```

In `PROD_FLAGS`, after `analytics: true,` (line 61) add:

```ts
  // Q1.4 — review prompts ship ON (owner decision 2026-07-28). The flag stays a kill-switch.
  // Nothing is promised to the user: iOS caps requestReview at ~3/year and may silently no-op,
  // so the rate limiting is ours (features/reviews/logic/reviewPromptLogic.ts), not the OS's.
  reviews: true,
```

In `BETA_FLAGS`, after `analytics: true,` add `reviews: true,`.
In `DEV_OVERRIDES`, after `analytics: true,` add `reviews: true, // Q1.4 — preview the sentiment gate in dev`.

- [ ] **Step 6: Extend the flag matrix tests**

In `src/config/__tests__/features.test.ts`, inside the `expectedOn` Set (after the `'reminders',` entry), add:

```ts
      // Q1.4 — review prompts (owner decision 2026-07-28). Deliberate extension: the sheet asks
      // a question, sells nothing, and promises nothing. Rate limiting is pinned in
      // features/reviews/logic/__tests__/reviewPromptLogic.test.ts.
      'reviews',
```

In `src/config/__tests__/features.prodFlags.test.ts`, add a new block after the immersive test:

```ts
  it('turns review prompts ON (Q1.4 — sheet asks a question, sells nothing)', () => {
    expect(PROD_FLAGS.reviews).toBe(true);
  });
```

- [ ] **Step 7: Add the analytics events**

In `src/utils/analytics.ts`, immediately before the `| (string & {});` line, insert:

```ts
  // Q1.4 — review prompts (sentiment gate). No amounts, no names.
  | 'review_prompt_shown'
  | 'review_sentiment'
  | 'review_native_requested'
  | 'review_feedback_opened'
  | 'review_prompt_dismissed'
```

- [ ] **Step 8: Migrate the two mailto call sites**

In `src/screens/ProfileScreen.tsx`, add `import { SUPPORT_EMAIL, supportMailto } from '../config/support';` and replace the hardcoded mailto URL at line 604 with `supportMailto('T Poker support')`. Replace the hardcoded address inside the a11y label (line 607) and the visible `<Text>` (line 610) with `{SUPPORT_EMAIL}` — the rendered text must still contain the literal address so `legalSurfaces.test.ts` stays green.

In `src/features/premium/ui/PaywallScreen.tsx`, add `import { supportMailto } from '../../../config/support';` and replace the hardcoded mailto at line 305 with `supportMailto('Purchase help')`.

- [ ] **Step 9: Run the affected suites**

Run: `npx jest src/config src/features/premium/__tests__/legalSurfaces.test.ts`
Expected: PASS. `legalSurfaces.test.ts` must still pass — if its ProfileScreen text assertion fails, the visible address was removed rather than substituted.

- [ ] **Step 10: Commit**

```bash
git add src/config src/utils/analytics.ts src/screens/ProfileScreen.tsx src/features/premium/ui/PaywallScreen.tsx
git commit -m "feat(reviews): reviews flag ON, typed review events, single SUPPORT_EMAIL constant"
```

---

### Task 4: Native review wrapper

**Files:**
- Create: `src/features/reviews/nativeReview.ts`, `src/features/reviews/__tests__/nativeReview.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `requestNativeReview(): Promise<boolean>` — resolves `true` only if the native call was actually made. Never throws.

- [ ] **Step 1: Read the Expo SDK 54 docs**

Open https://docs.expo.dev/versions/v54.0.0/sdk/storereview/ and confirm the exact exported function names and their return types before writing Step 3. The implementation below assumes `isAvailableAsync(): Promise<boolean>` and `requestReview(): Promise<void>`. **If the SDK 54 API differs, follow the docs, not this plan**, and adjust the test's mock to match.

- [ ] **Step 2: Install the dependency**

Run: `npx expo install expo-store-review`
Expected: `package.json` gains `expo-store-review` at the SDK-54-compatible version. `expo install` (not `npm install`) picks the version matching the installed SDK.

- [ ] **Step 3: Write the failing test**

Create `src/features/reviews/__tests__/nativeReview.test.ts`:

```ts
import * as StoreReview from 'expo-store-review';
import { requestNativeReview } from '../nativeReview';

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(),
  requestReview: jest.fn(),
}));

const mockAvailable = StoreReview.isAvailableAsync as jest.Mock;
const mockRequest = StoreReview.requestReview as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('requestNativeReview', () => {
  it('requests the review when the store review is available', async () => {
    mockAvailable.mockResolvedValue(true);
    mockRequest.mockResolvedValue(undefined);
    await expect(requestNativeReview()).resolves.toBe(true);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('returns false without requesting when unavailable', async () => {
    mockAvailable.mockResolvedValue(false);
    await expect(requestNativeReview()).resolves.toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('swallows a throwing availability check', async () => {
    mockAvailable.mockRejectedValue(new Error('no store'));
    await expect(requestNativeReview()).resolves.toBe(false);
  });

  it('swallows a throwing requestReview', async () => {
    mockAvailable.mockResolvedValue(true);
    mockRequest.mockRejectedValue(new Error('boom'));
    await expect(requestNativeReview()).resolves.toBe(false);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx jest src/features/reviews/__tests__/nativeReview.test.ts`
Expected: FAIL — `Cannot find module '../nativeReview'`.

- [ ] **Step 5: Write the implementation**

Create `src/features/reviews/nativeReview.ts`:

```ts
/**
 * NATIVE ONLY — every web call is a no-op, mirroring utils/reminders.ts.
 *
 * Returning `false` is a completely normal outcome, not an error: iOS caps requestReview at
 * ~3 prompts/year and may silently decline to show anything. Nothing in the UI may promise that
 * a rating dialog will appear, and no caller should treat `false` as a failure worth surfacing.
 */
import { Platform } from 'react-native';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

function getStoreReview(): typeof import('expo-store-review') | null {
  if (!isNative) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-store-review');
  } catch {
    return null;
  }
}

/** @returns true only if the native review request was actually issued. Never throws. */
export async function requestNativeReview(): Promise<boolean> {
  const SR = getStoreReview();
  if (!SR) return false;
  try {
    if (!(await SR.isAvailableAsync())) return false;
    await SR.requestReview();
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx jest src/features/reviews/__tests__/nativeReview.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Confirm the virtual-mock ban still passes**

Run: `npx jest src/utils/__tests__/jestMockHygieneBan.test.ts`
Expected: PASS — the mock above is a real module mock, not `{ virtual: true }`.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/features/reviews/nativeReview.ts src/features/reviews/__tests__
git commit -m "feat(reviews): native store-review wrapper — native-gated, never throws"
```

---

### Task 5: Expose `isCelebrating` from EngagementContext

**Files:**
- Modify: `src/features/engagement/state/EngagementContext.tsx:179` (the `value` object), its `EngagementContextType` interface, and the `useEngagement` fallback near line 197.

**Interfaces:**
- Produces: `EngagementContextType.isCelebrating: boolean`.

- [ ] **Step 1: Write the failing test**

Append to `src/features/engagement/state/__tests__/` a new file `isCelebrating.test.tsx`. If an existing EngagementContext test file already renders the provider, add these cases there instead and skip creating a new file.

```tsx
import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { EngagementProvider, useEngagement } from '../EngagementContext';

function Probe() {
  const { isCelebrating } = useEngagement();
  return <Text testID="flag">{String(isCelebrating)}</Text>;
}

describe('EngagementContext.isCelebrating', () => {
  it('is false at rest', async () => {
    const { getByTestId } = render(
      <EngagementProvider>
        <Probe />
      </EngagementProvider>,
    );
    await waitFor(() => expect(getByTestId('flag').props.children).toBe('false'));
  });

  it('is false from the no-provider fallback', () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('flag').props.children).toBe('false');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/features/engagement`
Expected: FAIL — TypeScript/runtime error: `isCelebrating` does not exist on the context type.

- [ ] **Step 3: Implement**

In `src/features/engagement/state/EngagementContext.tsx`:

1. Add `isCelebrating: boolean;` to the `EngagementContextType` interface.
2. Change the `value` object (line 179) to include it:

```ts
  // Q1.4 — the review-prompt host must never present over a celebration. This derives from the
  // state the provider already tracks; the ad-hoc 5500/2000ms collision constants above are
  // untouched and remain scheduled for replacement in Q3.5.
  const value: EngagementContextType = {
    enabled, isLoaded: stateLoaded, xpTotal, rank, signals, localAchievements,
    isCelebrating: unlockQueue.length > 0 || celebrate,
  };
```

3. Add `isCelebrating: false,` to the safe fallback object inside `useEngagement()`.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx jest src/features/engagement`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/engagement
git commit -m "feat(engagement): expose isCelebrating so the review host never covers a celebration"
```

---

### Task 6: Host context, surface hook, and the sentiment sheet

**Files:**
- Create: `src/features/reviews/state/ReviewPromptContext.tsx`, `src/features/reviews/state/useReviewSurface.ts`, `src/features/reviews/ui/SentimentSheet.tsx`
- Modify: `App.tsx:176` (inside `<EngagementProvider>`)

**Interfaces:**
- Consumes: everything from Tasks 1, 2, 4, 5; `config/support.ts` from Task 3.
- Produces: `ReviewPromptProvider`, `useReviewPrompt(): { recordMoment, armSurface, setProtectedRect }`, `useReviewSurface(surface)`, `ProtectedRect`.

- [ ] **Step 1: Write the sheet**

Create `src/features/reviews/ui/SentimentSheet.tsx`:

```tsx
/**
 * Direction A — symmetric and quiet (owner-selected 2026-07-28).
 *
 * The two answer buttons are BYTE-IDENTICAL in style. This is a correctness requirement, not a
 * taste preference: styling "Yes" as a gold CTA and "Not really" as a muted link manufactures the
 * happy answer to farm five-star ratings, which is the dark-pattern version of this feature.
 * No gold, no icons, no illustration.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet from '../../../components/BottomSheet';
import PressableScale from '../../../components/motion/PressableScale';
import { colors } from '../../../theme/colors';
import { radii } from '../../../theme/radii';
import { spacing } from '../../../theme/spacing';
import { typography } from '../../../theme/typography';

type Props = {
  visible: boolean;
  onHappy: () => void;
  onUnhappy: () => void;
  onDismiss: () => void;
};

export default function SentimentSheet({ visible, onHappy, onUnhappy, onDismiss }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onDismiss} showHandle>
      <Text style={styles.question} accessibilityRole="header">
        Enjoying T Poker?
      </Text>

      <View style={styles.row}>
        <PressableScale
          style={styles.choice}
          onPress={onUnhappy}
          accessibilityRole="button"
          accessibilityLabel="Not really"
        >
          <Text style={styles.choiceLabel}>Not really</Text>
        </PressableScale>

        <PressableScale
          style={styles.choice}
          onPress={onHappy}
          accessibilityRole="button"
          accessibilityLabel="Yes"
        >
          <Text style={styles.choiceLabel}>Yes</Text>
        </PressableScale>
      </View>

      <PressableScale
        style={styles.later}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Not now"
      >
        <Text style={styles.laterLabel}>Not now</Text>
      </PressableScale>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  question: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  // Both choices share ONE style object — they cannot drift apart.
  choice: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceLabel: { ...typography.label, color: colors.text },
  later: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  laterLabel: { ...typography.bodySmall, color: colors.textMuted },
});
```

If `typography.h3` does not exist, use `typography.title` — check `src/theme/typography.ts` and pick the nearest existing heading token. Do not invent one and do not hardcode a size.

- [ ] **Step 2: Write the host context**

Create `src/features/reviews/state/ReviewPromptContext.tsx`:

```tsx
/**
 * Review-prompt host. Owns the counters and the decision; screens only report what happened and
 * where their protected content is.
 *
 * Why one host instead of per-screen state: three screens produce qualifying moments and three can
 * present. Duplicating the rate limiting is how "once per 90 days" quietly becomes "three times
 * per 90 days".
 */
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { isFeatureEnabled } from '../../../config/features';
import { supportMailto } from '../../../config/support';
import { track } from '../../../utils/analytics';
import { useEngagement } from '../../engagement/state/EngagementContext';
import {
  DWELL_MS,
  SHEET_OCCLUSION_H,
  canPresentNow,
  evaluateReviewPrompt,
  regionState,
  type DwellSurface,
  type ReviewMomentKind,
  type ReviewPromptState,
} from '../logic/reviewPromptLogic';
import { defaultReviewPromptState, loadReviewPromptState, saveReviewPromptState } from '../data/reviewPromptStore';
import { requestNativeReview } from '../nativeReview';
import SentimentSheet from '../ui/SentimentSheet';

export interface ProtectedRect { top: number; bottom: number; viewportH: number }

interface ReviewPromptContextType {
  recordMoment: (kind: ReviewMomentKind) => void;
  armSurface: (surface: DwellSurface | null) => void;
  setProtectedRect: (rect: ProtectedRect | null) => void;
}

const Ctx = createContext<ReviewPromptContextType | null>(null);

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const TICK_MS = 500;

export function ReviewPromptProvider({ children }: { children: React.ReactNode }) {
  const enabled = isFeatureEnabled('reviews');
  const { isCelebrating } = useEngagement();

  const [state, setState] = useState<ReviewPromptState>(() => defaultReviewPromptState(Date.now()));
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);

  const surfaceRef = useRef<DwellSurface | null>(null);
  const armedAtRef = useRef<number | null>(null);
  const rectRef = useRef<ProtectedRect | null>(null);
  const seenRef = useRef(false);
  const shownThisMountRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadReviewPromptState(Date.now()).then(s => { if (alive) { setState(s); setLoaded(true); } });
    return () => { alive = false; };
  }, [enabled]);

  const persist = useCallback((next: ReviewPromptState) => {
    setState(next);
    void saveReviewPromptState(next);
  }, []);

  const recordMoment = useCallback((kind: ReviewMomentKind) => {
    if (!enabled || !loaded) return;
    setState(prev => {
      const next = { ...prev, moments: prev.moments + 1 };
      void saveReviewPromptState(next);
      return next;
    });
    // kind is carried on the impression event, not stored — we rate-limit showing, not kinds.
    lastKindRef.current = kind;
  }, [enabled, loaded]);

  const lastKindRef = useRef<ReviewMomentKind | null>(null);

  const armSurface = useCallback((surface: DwellSurface | null) => {
    surfaceRef.current = surface;
    armedAtRef.current = surface ? Date.now() : null;
    rectRef.current = null;
    seenRef.current = false;
  }, []);

  const setProtectedRect = useCallback((rect: ProtectedRect | null) => {
    rectRef.current = rect;
    if (rect) {
      const rs = regionState({ ...rect, sheetH: SHEET_OCCLUSION_H });
      if (rs.fullyVisibleAboveSheet) seenRef.current = true; // sticky
    }
  }, []);

  // Poll rather than react: dwell is time-based, and scroll position changes without a re-render.
  useEffect(() => {
    if (!enabled || !loaded || visible || shownThisMountRef.current) return;
    const id = setInterval(() => {
      const surface = surfaceRef.current;
      const armedAt = armedAtRef.current;
      if (!surface || armedAt === null) return;

      const now = Date.now();
      if (!evaluateReviewPrompt(state, { nowMs: now, appVersion: APP_VERSION }).eligible) return;

      const rect = rectRef.current;
      const rs = rect ? regionState({ ...rect, sheetH: SHEET_OCCLUSION_H }) : null;

      const ok = canPresentNow({
        dwellElapsedMs: now - armedAt,
        requiredDwellMs: DWELL_MS[surface],
        isCelebrating,
        protectedRegion: rs ? { seen: seenRef.current, intersectsSheet: rs.intersectsSheet } : null,
      });
      if (!ok) return;

      shownThisMountRef.current = true;
      setVisible(true);
      // Showing consumes the allowance, whichever button is pressed and even if none is.
      persist({ ...state, lastPromptedAt: now, promptedVersions: [...state.promptedVersions, APP_VERSION] });
      track('review_prompt_shown', { moment_kind: lastKindRef.current ?? 'unknown', moments: state.moments });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [enabled, loaded, visible, isCelebrating, state, persist]);

  const onHappy = useCallback(async () => {
    setVisible(false);
    persist({ ...state, lastSentiment: 'happy' });
    track('review_sentiment', { value: 'happy' });
    const requested = await requestNativeReview();
    track('review_native_requested', { available: requested });
  }, [state, persist]);

  const onUnhappy = useCallback(() => {
    setVisible(false);
    persist({ ...state, lastSentiment: 'unhappy' });
    track('review_sentiment', { value: 'unhappy' });
    track('review_feedback_opened');
    void Linking.openURL(
      supportMailto('T Poker feedback', 'What could be better?\n\n'),
    ).catch(() => {});
  }, [state, persist]);

  const onDismiss = useCallback(() => {
    setVisible(false);
    track('review_prompt_dismissed');
  }, []);

  return (
    <Ctx.Provider value={{ recordMoment, armSurface, setProtectedRect }}>
      {children}
      {enabled && <SentimentSheet visible={visible} onHappy={onHappy} onUnhappy={onUnhappy} onDismiss={onDismiss} />}
    </Ctx.Provider>
  );
}

export function useReviewPrompt(): ReviewPromptContextType {
  return useContext(Ctx) ?? { recordMoment: () => {}, armSurface: () => {}, setProtectedRect: () => {} };
}
```

- [ ] **Step 3: Write the surface hook**

Create `src/features/reviews/state/useReviewSurface.ts`:

```ts
/**
 * Screen-facing helper. Converts ScrollView geometry into the viewport-space rect the host needs,
 * so screens never do the arithmetic themselves.
 *
 * Usage:
 *   const review = useReviewSurface('game_summary');
 *   <ScrollView onScroll={review.onScroll} scrollEventThrottle={16} onLayout={review.onViewportLayout}>
 *     <View onLayout={review.onProtectedLayout}>...settlements...</View>
 */
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { DwellSurface } from '../logic/reviewPromptLogic';
import { useReviewPrompt } from './ReviewPromptContext';

export function useReviewSurface(surface: DwellSurface) {
  const { armSurface, setProtectedRect } = useReviewPrompt();
  const sectionY = useRef<number | null>(null);
  const sectionH = useRef(0);
  const scrollY = useRef(0);
  const viewportH = useRef(0);

  useEffect(() => {
    armSurface(surface);
    return () => armSurface(null);
  }, [surface, armSurface]);

  const publish = useCallback(() => {
    if (sectionY.current === null || viewportH.current === 0) return;
    const top = sectionY.current - scrollY.current;
    setProtectedRect({ top, bottom: top + sectionH.current, viewportH: viewportH.current });
  }, [setProtectedRect]);

  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    viewportH.current = e.nativeEvent.layout.height;
    publish();
  }, [publish]);

  const onProtectedLayout = useCallback((e: LayoutChangeEvent) => {
    sectionY.current = e.nativeEvent.layout.y;
    sectionH.current = e.nativeEvent.layout.height;
    publish();
  }, [publish]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    publish();
  }, [publish]);

  return { onViewportLayout, onProtectedLayout, onScroll };
}
```

- [ ] **Step 4: Mount the provider**

In `App.tsx`, wrap the existing children of `<EngagementProvider>`. It must sit **inside** `EngagementProvider` (it consumes `useEngagement`). Add the import `import { ReviewPromptProvider } from './src/features/reviews/state/ReviewPromptContext';` and change:

```tsx
                    <EngagementProvider>
                      <ReviewPromptProvider>
                      <StatusBar style="light" />
                      ...unchanged...
                      </ReviewPromptProvider>
                    </EngagementProvider>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. Fix any token names that do not exist (`typography.h3`, `radii.lg`) against the real theme files rather than hardcoding values.

- [ ] **Step 6: Commit**

```bash
git add src/features/reviews App.tsx
git commit -m "feat(reviews): sentiment sheet + host context + surface hook"
```

---

### Task 7: Wire the three surfaces

**Files:**
- Modify: `src/features/study/ui/SpotTrainerScreen.tsx:137-144`, `src/screens/LocalSessionSummaryScreen.tsx:209,314`, `src/screens/SessionScreen.tsx:1941`

- [ ] **Step 1: Trainer results (drill ≥70%)**

In `src/features/study/ui/SpotTrainerScreen.tsx`, add `import { useReviewPrompt } from '../../reviews/state/ReviewPromptContext';` and `import { useReviewSurface } from '../../reviews/state/useReviewSurface';`.

Inside the component add `const { recordMoment } = useReviewPrompt();`. In `finishSession()` (line 137), after the existing `track(...)` call and before `setDone(true)`, add:

```ts
    // Q1.4 — a strong drill is a qualifying moment. The ≥70% threshold matches the existing
    // Celebration gate on the results screen, so the moment and the confetti agree.
    if (acc >= 70) recordMoment('drill_strong');
```

In the `if (done)` results branch (line 185), arm the surface. Because this branch returns early, call the hook unconditionally at the top of the component instead:

```ts
  const reviewSurface = useReviewSurface('drill_results');
```

and reference `reviewSurface` nowhere else — the results screen has no protected region, so arming is all that is required. **Important:** `useReviewSurface` arms on mount, so calling it unconditionally would arm the surface while the drill is still running. Guard it by moving the arm into the `done` branch via a small effect instead:

```ts
  const { recordMoment, armSurface } = useReviewPrompt();
  useEffect(() => {
    if (!done) return;
    armSurface('drill_results');
    return () => armSurface(null);
  }, [done, armSurface]);
```

Use this effect form and do **not** call `useReviewSurface` here.

- [ ] **Step 2: Local game summary**

In `src/screens/LocalSessionSummaryScreen.tsx`, add the imports and:

```tsx
  const { recordMoment } = useReviewPrompt();
  const review = useReviewSurface('game_summary');

  useEffect(() => {
    if (justEnded) recordMoment('game_summary');
  }, [justEnded, recordMoment]);
```

On the `<ScrollView>` (line 209) add `onScroll={review.onScroll} scrollEventThrottle={16} onLayout={review.onViewportLayout}`.

Wrap the settlements block — from the `CASH SETTLEMENTS` `<Text>` (line 314) through the end of the `transfers.map(...)` — in a single `<View onLayout={review.onProtectedLayout}>`. Do not change any styling; the wrapper is layout-transparent (no style prop).

- [ ] **Step 3: Server session summary**

In `src/screens/SessionScreen.tsx`, add the imports and `const { recordMoment } = useReviewPrompt();` plus `const review = useReviewSurface('game_summary');`.

Find where `endStep` is reset to `0` from the step-3 modal (the summary's close/done handler). Add `recordMoment('game_summary');` there — **not** while the modal is open. If no explicit handler exists, add one to the modal's dismiss control rather than using `onRequestClose` alone, so web parity holds.

Apply the same `onScroll` / `onLayout` / protected-wrapper treatment to the screen's settlements section as in Step 2. This is additive instrumentation only — do not restructure anything.

- [ ] **Step 4: Streak milestone**

In `src/features/reviews/state/ReviewPromptContext.tsx`, add a `recordStreakMilestone(studyStreak: number)` callback to the context that only counts when `studyStreak >= 7 && studyStreak > state.streakMilestoneHigh`, then persists the new high-water mark and calls `recordMoment('streak_milestone')`. Call it from `StudyScreen` where the study streak is already read (`StudyScreen.tsx:91-108`). **Use the study-day streak only** — never `HomeScreen`'s win/loss streak.

- [ ] **Step 5: Typecheck and full suite**

Run: `npx tsc --noEmit && npx jest`
Expected: 0 type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/study src/screens src/features/reviews
git commit -m "feat(reviews): wire the three qualifying surfaces + settlement-safe presentation"
```

---

### Task 8: Full gates and documentation

- [ ] **Step 1: Run every gate**

```bash
cd apps/poker-mobile
npx tsc --noEmit
npx jest
npm run build:web
```
Expected: 0 type errors; all tests pass; the web export completes. Record the actual jest count — do not claim a number you did not see.

- [ ] **Step 2: Manual reduced-motion and web checks**

- Enable OS "reduce motion" and confirm the sheet appears without a slide (BottomSheet already handles this — verify, do not assume).
- Load the web build and confirm the sheet never appears (native-gated) and nothing throws.
- Confirm both answer buttons are visually identical.

- [ ] **Step 3: Update CLAUDE.md**

Add a short section documenting the `reviews` flag, the four moment kinds, the three presentation surfaces, and the rule that only the study-day streak qualifies.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "docs(reviews): document the review-prompt slice in CLAUDE.md"
git push
```

- [ ] **Step 5: Adversarial critic fleet**

Push first (Step 4), then run the fleet. Critics hunt specifically for: honesty-pin regressions; copy claiming something untrue; the win/loss streak sneaking in; chained (non-composed) writes; stale closures in the host's interval; UTC date escapees; anything purchasable; AI calls; guest-tier reductions; a11y regressions; and pins that do not actually pin what they claim — mutation-test them.

---

## Self-Review

**Spec coverage:** §3 architecture → Tasks 1,2,4,6. §4 data → Task 2. §5 rules → Task 1. §5 protected region → Tasks 1,6,7. §5 celebration coordination → Task 5. §6 pins → Tasks 1,3. §7 copy → Task 6. §8 support email → Task 3. §9 analytics → Task 3. §10 platform → Task 4. §12 testing → every task. No gaps.

**Known wrinkle carried deliberately:** Task 7 Step 1 contains a correction to itself (do not use `useReviewSurface` in the trainer, use the guarded effect). It is written that way on purpose — the obvious approach arms the surface while the drill is still running, which would start the dwell clock mid-task. The wrong path is shown so the implementer does not rediscover it.

**Type consistency:** `recordMoment` / `armSurface` / `setProtectedRect` / `useReviewSurface` / `requestNativeReview` / `supportMailto` are named identically everywhere they appear.
