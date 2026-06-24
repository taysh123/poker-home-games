# Free Training Taste (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the free training taste — 4 free lesson packs unlocked, a metered free daily quiz (1/day) + limited Spot Trainer (3 sessions/day) with honest flag-adaptive nudges, and quiz/lesson completion feeding the XP/streak loop — by flipping `study`/`content`/`retention` ON while `paywall` stays OFF.

**Architecture:** Two gating dimensions. **Content access** (pack-level) reuses the existing pure `availabilityOf(pack, hasPremium)` in `features/premium/logic/marketableLabel.ts`, where `hasPremium` is the server-authoritative `useEntitlements().isPremium`; we surface its lock states inside Study (today they live only in the Pack Catalog). **Daily interactive limits** (free-only, client-side) are new: a pure `dailyLimits.ts` decision function fed by a date-stamped counter persisted in `studyStore`, reset on each new local day, bypassed entirely for premium. The free daily quiz is restricted to free-pack content via the existing row-level `selectQuestions({ freeOnly: true })`. Every "limit reached" / "pack locked" surface is **flag-adaptive**: with `paywall` OFF it shows honest "coming soon" copy and no purchase path; with `paywall` ON it routes to the existing `PaywallScreen`. XP is derived from local signals, so quiz/lesson completion XP is added by persisting two new completion counters in study progress and weighting them in `computeXp`.

**Tech Stack:** Expo SDK 54 (React Native + react-native-web), TypeScript, Jest (`ts-jest`), `@react-native-async-storage/async-storage`, React Navigation, existing design-system primitives (`Screen`, `Card`, `Chip`, `PrimaryButton`, `PressableScale`, `Ionicons`), feature flags in `src/config/features.ts`.

---

## Context the engineer must know before starting

**Paths differ from intuition — use these exact paths:**
- Study store lives at `apps/poker-mobile/src/features/study/data/studyStore.ts` (NOT the study root).
- Pack-access logic lives at `apps/poker-mobile/src/features/premium/logic/marketableLabel.ts` (NOT under `study/logic`).
- `apps/poker-mobile/src/features/study/config.ts` does **not** exist yet — Task 1 creates it.

**Entitlement source of truth:** read `isPremium` from `useEntitlements()` (`src/context/EntitlementsContext.tsx`) — it is server-authoritative and fail-closed (guests + offline ⇒ free). Do **not** read `usePremium()` directly in screens. `StudyContext` already consumes `useEntitlements()`.

**Premium is a single tier today:** `availabilityOf` returns `'available'` for `free` and `free_plus_premium` packs, `'locked'` for `premium` when `!hasPremium`, and `'coming_soon'` for future packs. The 4 free packs (PACK-01, PACK-05, PACK-06, PACK-12) are `FreeOrPremium = "Free + Premium"` in `premium_content_catalog`; the 8 premium packs are `"Premium"`. No code maps pack IDs — the catalog rows drive it.

**Quiz free-gate is row-level, not pack-join.** `quiz.ts`/`normalizeQuestion` parses `FreeOrPremium` per row into `QuizQuestion.free`, and `selectQuestions({ freeOnly: true })` already filters to free rows. All bundled quiz rows are currently `Free`, so non-premium users see all bundled quizzes today; when premium quiz rows ship later, `freeOnly` excludes them automatically. This is the honest, forward-safe gate.

**XP is DERIVED, not event-driven.** `computeXp(signals, achievementsUnlocked)` multiplies `EngagementSignals` counts by `XP_WEIGHTS`. Spot answers already flow via `progress.totalAnswered → signals.spotsAnswered`. To grant XP for quiz/lesson completion we persist two new counters in `StudyProgress`, expose them on `EngagementSignals`, and add two `XP_WEIGHTS`. There is no per-event XP ledger to touch.

**Store migration pattern:** `studyStore.ts` validates `schemaVersion`, quarantines corrupt payloads (`tpoker.study.quarantine.<ts>`), and merges loaded progress over `emptyProgress()` defaults in `migrateToCurrent`. New fields are additive and default via that spread. This plan bumps `STUDY_SCHEMA_VERSION` 1 → 2 and widens `isValidFile` to accept both versions (so existing v1 payloads migrate, not quarantine).

**Flag-adaptive nudge precedent:** `PackDetailScreen.tsx` already shows a `lockNote` row (`lock-closed` icon + muted text) and, when locked, a `PrimaryButton` → `navigation.navigate('Paywall', { trigger })`. Mirror that affordance. The new wrinkle for P1: gate the purchase path on `isFeatureEnabled('paywall')`.

**Cross-platform:** `Alert.alert` is a no-op on web — never use it. This plan uses inline UI (cards/banners), not dialogs, for limit/lock states.

---

## File Structure

```
apps/poker-mobile/src/
├── config/
│   ├── features.ts                          # MODIFY  flip study/content/retention ON in PROD_FLAGS
│   └── __tests__/
│       └── features.prodFlags.test.ts       # CREATE  asserts the exact PROD_FLAGS launch state (honesty CI guard)
├── features/
│   ├── study/
│   │   ├── config.ts                        # CREATE  FREE_QUIZ_PER_DAY, FREE_TRAINER_SESSIONS_PER_DAY (tunable)
│   │   ├── types.ts                         # MODIFY  schemaVersion 2; dailyLimitCounters + quizzesCompleted/lessonsCompleted
│   │   ├── logic/
│   │   │   ├── dailyLimits.ts               # CREATE  PURE limit decision + counter increment/read helpers
│   │   │   ├── progress.ts                  # MODIFY  default + record the two completion counters; reset-safe today-counter helpers
│   │   │   └── __tests__/
│   │   │       ├── dailyLimits.test.ts      # CREATE  TDD centerpiece — rich limit/reset/premium/remaining suite
│   │   │       └── progress.test.ts         # MODIFY  add tests for completion counters
│   │   ├── data/
│   │   │   ├── studyStore.ts                # MODIFY  v1→v2 migration; accept both versions; quarantine preserved
│   │   │   └── __tests__/
│   │   │       └── studyStore.test.ts       # CREATE  load/migrate/quarantine/round-trip with AsyncStorage mock
│   │   ├── state/
│   │   │   └── StudyContext.tsx             # MODIFY  expose limit reads + recordQuizCompleted/recordLessonCompleted + counter consume
│   │   └── ui/
│   │       ├── QuizRunnerScreen.tsx         # MODIFY  free daily-quiz gate, remaining indicator, flag-adaptive nudge, freeOnly select, completion record
│   │       ├── SpotTrainerScreen.tsx        # MODIFY  free trainer-session gate (block 4th/day), remaining indicator, flag-adaptive nudge
│   │       ├── LessonModulesScreen.tsx      # MODIFY  per-module lock chips via pack access + completion record on read
│   │       ├── StudyScreen.tsx              # MODIFY  free/premium lock summary row (4 unlocked / 8 locked) + flag-adaptive CTA
│   │       └── LockNudge.tsx                # CREATE  shared flag-adaptive lock/limit affordance (one consistent component)
│   └── engagement/
│       ├── types.ts                         # MODIFY  EngagementSignals += quizzesCompleted, lessonsCompleted
│       ├── logic/
│       │   ├── xp.ts                        # MODIFY  XP_WEIGHTS += quizCompleted, lessonCompleted; computeXp uses them
│       │   └── __tests__/xp.test.ts         # MODIFY  add weighting assertions for the two new signals
│       └── state/
│           └── EngagementContext.tsx        # MODIFY  derive the two new signals from study progress
└── utils/
    └── analytics.ts                         # MODIFY  add 'study_quiz_completed' + 'study_lesson_completed' events
```

---

## Task 1: Free-limit config constants

**Files:**
- Create: `apps/poker-mobile/src/features/study/config.ts`

- [ ] **Step 1: Create the config module**

These are the tunable knobs the spec (§4, §6) requires — interactive free reps per local day. Premium is unlimited (handled in `dailyLimits.ts`, not here).

```typescript
// apps/poker-mobile/src/features/study/config.ts
/**
 * Free training-taste limits — the SINGLE source of tunable free-rep knobs (Phase 1).
 * These meter FREE interactive content, NOT revenue: enforced client-side, reset on a new
 * local day, and bypassed entirely for premium (see logic/dailyLimits.ts). Lessons in free
 * packs are UNMETERED — only quizzes and Spot Trainer sessions are limited.
 */

/** Free multiple-choice quizzes a non-premium user may complete per local day. */
export const FREE_QUIZ_PER_DAY = 1;

/** Free Spot Trainer sessions a non-premium user may start per local day. */
export const FREE_TRAINER_SESSIONS_PER_DAY = 3;

/** Counter kinds tracked for daily limits. Keep in sync with StudyProgress.dailyLimitCounters. */
export type DailyLimitKind = 'quiz' | 'trainerSession';

/** Free per-day cap for each metered activity. Premium bypasses (Infinity). */
export const FREE_DAILY_LIMITS: Record<DailyLimitKind, number> = {
  quiz: FREE_QUIZ_PER_DAY,
  trainerSession: FREE_TRAINER_SESSIONS_PER_DAY,
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS (no errors). The file is pure constants + a type; nothing imports it yet.

- [ ] **Step 3: Commit**

```bash
git add apps/poker-mobile/src/features/study/config.ts
git commit -m "feat(study): free training-taste limit constants (1 quiz/day, 3 trainer sessions/day)"
```

---

## Task 2: Pure daily-limit decision logic (TDD centerpiece)

**Files:**
- Create: `apps/poker-mobile/src/features/study/logic/dailyLimits.ts`
- Test: `apps/poker-mobile/src/features/study/logic/__tests__/dailyLimits.test.ts`

The counter shape: `Record<DailyLimitKind, { dayKey: string; count: number }>`. A counter is "for today" only when its `dayKey` equals the passed `todayKey`; otherwise it is treated as 0 (reset on a new local day). `dayKey` is the caller's `YYYY-MM-DD` local-day string (same convention as `StudyContext.todayKey`).

- [ ] **Step 1: Write the failing test (full suite — this is the centerpiece)**

```typescript
// apps/poker-mobile/src/features/study/logic/__tests__/dailyLimits.test.ts
import {
  emptyDailyCounters,
  remainingToday,
  limitStatus,
  consumeToday,
  type DailyLimitCounters,
} from '../dailyLimits';
import { FREE_QUIZ_PER_DAY, FREE_TRAINER_SESSIONS_PER_DAY } from '../../config';

const TODAY = '2026-06-25';
const YESTERDAY = '2026-06-24';

describe('emptyDailyCounters', () => {
  it('starts both kinds at zero with no day', () => {
    const c = emptyDailyCounters();
    expect(c.quiz).toEqual({ dayKey: '', count: 0 });
    expect(c.trainerSession).toEqual({ dayKey: '', count: 0 });
  });
});

describe('remainingToday', () => {
  it('returns the full free allowance when nothing done today (free user)', () => {
    expect(remainingToday(emptyDailyCounters(), 'quiz', TODAY, false)).toBe(FREE_QUIZ_PER_DAY);
    expect(remainingToday(emptyDailyCounters(), 'trainerSession', TODAY, false)).toBe(FREE_TRAINER_SESSIONS_PER_DAY);
  });

  it('subtracts today’s count for a free user', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), trainerSession: { dayKey: TODAY, count: 2 } };
    expect(remainingToday(c, 'trainerSession', TODAY, false)).toBe(FREE_TRAINER_SESSIONS_PER_DAY - 2);
  });

  it('never goes negative even if the stored count somehow exceeds the cap', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: TODAY, count: 99 } };
    expect(remainingToday(c, 'quiz', TODAY, false)).toBe(0);
  });

  it('resets to the full allowance on a new local day (yesterday’s count is ignored)', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: YESTERDAY, count: FREE_QUIZ_PER_DAY } };
    expect(remainingToday(c, 'quiz', TODAY, false)).toBe(FREE_QUIZ_PER_DAY);
  });

  it('is Infinity for premium regardless of count', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: TODAY, count: 100 } };
    expect(remainingToday(c, 'quiz', TODAY, true)).toBe(Infinity);
  });
});

describe('limitStatus', () => {
  it('allows a free user with reps left and reports remaining', () => {
    expect(limitStatus(emptyDailyCounters(), 'quiz', TODAY, false)).toEqual({ allowed: true, remaining: FREE_QUIZ_PER_DAY });
  });

  it('blocks a free user once the daily cap is reached', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: TODAY, count: FREE_QUIZ_PER_DAY } };
    expect(limitStatus(c, 'quiz', TODAY, false)).toEqual({ allowed: false, remaining: 0 });
  });

  it('blocks the 4th trainer session of the day for a free user', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), trainerSession: { dayKey: TODAY, count: FREE_TRAINER_SESSIONS_PER_DAY } };
    const s = limitStatus(c, 'trainerSession', TODAY, false);
    expect(s.allowed).toBe(false);
    expect(s.remaining).toBe(0);
  });

  it('re-allows after the day rolls over', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), trainerSession: { dayKey: YESTERDAY, count: FREE_TRAINER_SESSIONS_PER_DAY } };
    expect(limitStatus(c, 'trainerSession', TODAY, false)).toEqual({ allowed: true, remaining: FREE_TRAINER_SESSIONS_PER_DAY });
  });

  it('always allows premium with remaining Infinity', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: TODAY, count: 50 } };
    expect(limitStatus(c, 'quiz', TODAY, true)).toEqual({ allowed: true, remaining: Infinity });
  });
});

describe('consumeToday', () => {
  it('increments the kind for today, leaving the other kind untouched', () => {
    const next = consumeToday(emptyDailyCounters(), 'quiz', TODAY);
    expect(next.quiz).toEqual({ dayKey: TODAY, count: 1 });
    expect(next.trainerSession).toEqual({ dayKey: '', count: 0 });
  });

  it('resets the count to 1 when consuming on a new day', () => {
    const c: DailyLimitCounters = { ...emptyDailyCounters(), quiz: { dayKey: YESTERDAY, count: 5 } };
    expect(consumeToday(c, 'quiz', TODAY).quiz).toEqual({ dayKey: TODAY, count: 1 });
  });

  it('accumulates within the same day', () => {
    let c = consumeToday(emptyDailyCounters(), 'trainerSession', TODAY);
    c = consumeToday(c, 'trainerSession', TODAY);
    expect(c.trainerSession).toEqual({ dayKey: TODAY, count: 2 });
  });

  it('is pure — does not mutate the input', () => {
    const c = emptyDailyCounters();
    const next = consumeToday(c, 'quiz', TODAY);
    expect(c.quiz.count).toBe(0);
    expect(next).not.toBe(c);
  });

  it('three consumes then a block models the free trainer day exactly', () => {
    let c = emptyDailyCounters();
    for (let i = 0; i < FREE_TRAINER_SESSIONS_PER_DAY; i++) {
      expect(limitStatus(c, 'trainerSession', TODAY, false).allowed).toBe(true);
      c = consumeToday(c, 'trainerSession', TODAY);
    }
    expect(limitStatus(c, 'trainerSession', TODAY, false).allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/poker-mobile && npx jest src/features/study/logic/__tests__/dailyLimits.test.ts`
Expected: FAIL — `Cannot find module '../dailyLimits'`.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// apps/poker-mobile/src/features/study/logic/dailyLimits.ts
/**
 * Daily free-limit logic (Phase 1) — PURE, testable. Decides whether a free user may do one more
 * metered interactive rep today, and how many remain. Premium bypasses (unlimited). Counters are
 * date-stamped: a counter only counts toward today when its dayKey === todayKey, so a new local day
 * resets the allowance automatically. No I/O, no React, no Date.now — the caller passes todayKey.
 */
import { FREE_DAILY_LIMITS, type DailyLimitKind } from '../config';

export type { DailyLimitKind };

/** One metered activity's progress for a single local day. */
export interface DailyLimitCounter {
  /** YYYY-MM-DD the count applies to. Empty string = never used. */
  dayKey: string;
  /** Reps done on dayKey. */
  count: number;
}

export type DailyLimitCounters = Record<DailyLimitKind, DailyLimitCounter>;

export interface LimitStatus {
  /** True when the user may do one more rep now. */
  allowed: boolean;
  /** Reps left today (Infinity for premium). */
  remaining: number;
}

/** Fresh counters (no day, zero counts). */
export function emptyDailyCounters(): DailyLimitCounters {
  return { quiz: { dayKey: '', count: 0 }, trainerSession: { dayKey: '', count: 0 } };
}

/** Count applied to today only (0 if the stored counter belongs to another day). */
function countToday(counters: DailyLimitCounters, kind: DailyLimitKind, todayKey: string): number {
  const c = counters[kind];
  return c.dayKey === todayKey ? c.count : 0;
}

/** Reps remaining today. Infinity for premium. Never negative for free. */
export function remainingToday(
  counters: DailyLimitCounters,
  kind: DailyLimitKind,
  todayKey: string,
  isPremium: boolean,
): number {
  if (isPremium) return Infinity;
  const used = countToday(counters, kind, todayKey);
  return Math.max(0, FREE_DAILY_LIMITS[kind] - used);
}

/** Whether one more rep is allowed now, plus the remaining count. */
export function limitStatus(
  counters: DailyLimitCounters,
  kind: DailyLimitKind,
  todayKey: string,
  isPremium: boolean,
): LimitStatus {
  const remaining = remainingToday(counters, kind, todayKey, isPremium);
  return { allowed: remaining > 0, remaining };
}

/** Record one rep for today (resets to 1 on a new day). Pure — returns new counters. */
export function consumeToday(
  counters: DailyLimitCounters,
  kind: DailyLimitKind,
  todayKey: string,
): DailyLimitCounters {
  const isToday = counters[kind].dayKey === todayKey;
  return { ...counters, [kind]: { dayKey: todayKey, count: (isToday ? counters[kind].count : 0) + 1 } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/poker-mobile && npx jest src/features/study/logic/__tests__/dailyLimits.test.ts`
Expected: PASS — all suites green.

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/features/study/logic/dailyLimits.ts apps/poker-mobile/src/features/study/logic/__tests__/dailyLimits.test.ts
git commit -m "feat(study): pure daily free-limit logic with full TDD suite"
```

---

## Task 3: Study progress schema — daily counters + completion counters (v2 migration)

**Files:**
- Modify: `apps/poker-mobile/src/features/study/types.ts`
- Modify: `apps/poker-mobile/src/features/study/logic/progress.ts`
- Test: `apps/poker-mobile/src/features/study/logic/__tests__/progress.test.ts`

- [ ] **Step 1: Write the failing tests (new progress behavior)**

Append these to the existing `progress.test.ts`. They cover the two new completion counters and the default shape.

```typescript
// append to apps/poker-mobile/src/features/study/logic/__tests__/progress.test.ts
import { recordQuizCompleted, recordLessonCompleted } from '../progress';

describe('emptyProgress — Phase 1 additive fields', () => {
  it('defaults daily-limit counters and completion counters', () => {
    const p = emptyProgress();
    expect(p.dailyLimitCounters).toEqual({ quiz: { dayKey: '', count: 0 }, trainerSession: { dayKey: '', count: 0 } });
    expect(p.quizzesCompleted).toBe(0);
    expect(p.lessonsCompleted).toBe(0);
  });
});

describe('recordQuizCompleted', () => {
  it('increments quizzesCompleted only (pure)', () => {
    const p = emptyProgress();
    const next = recordQuizCompleted(p);
    expect(next.quizzesCompleted).toBe(1);
    expect(p.quizzesCompleted).toBe(0); // input untouched
    expect(next.lessonsCompleted).toBe(0);
  });
});

describe('recordLessonCompleted', () => {
  it('increments lessonsCompleted only (pure, idempotent input)', () => {
    const p = emptyProgress();
    const next = recordLessonCompleted(p);
    expect(next.lessonsCompleted).toBe(1);
    expect(p.lessonsCompleted).toBe(0);
    expect(next.quizzesCompleted).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/poker-mobile && npx jest src/features/study/logic/__tests__/progress.test.ts`
Expected: FAIL — `recordQuizCompleted`/`recordLessonCompleted` not exported; `dailyLimitCounters`/`quizzesCompleted` undefined.

- [ ] **Step 3: Update types — bump schema to v2, add fields**

In `apps/poker-mobile/src/features/study/types.ts`, change the schema constant and the progress interface.

Replace:
```typescript
export const STUDY_SCHEMA_VERSION = 1 as const;
```
with:
```typescript
export const STUDY_SCHEMA_VERSION = 2 as const;
```

Add an import of the counter type at the top of the file (after the existing header comment / before the first `export type`):
```typescript
import type { DailyLimitCounters } from './logic/dailyLimits';
```

Then, inside `interface StudyProgress`, add these fields after `freezeWeekKey?: string;`:
```typescript
  // Phase 1 — free training taste (additive; absent on v1 data, defaulted on load).
  /** Date-stamped per-day counters for metered free interactive reps (quiz / trainer session). */
  dailyLimitCounters?: DailyLimitCounters;
  /** Lifetime free/premium quizzes completed (feeds XP). */
  quizzesCompleted?: number;
  /** Lifetime lessons completed/read (feeds XP). */
  lessonsCompleted?: number;
```

Note: `schemaVersion` on `StudyProgress`/`StudyFile` is typed `typeof STUDY_SCHEMA_VERSION`, which now resolves to `2` — handled by the store migration in Task 4.

- [ ] **Step 4: Update `progress.ts` — defaults + record helpers**

In `apps/poker-mobile/src/features/study/logic/progress.ts`:

Add the import at the top (after the existing `types` import):
```typescript
import { emptyDailyCounters, type DailyLimitCounters } from './dailyLimits';
```

In `emptyProgress`, add the three new defaults to the returned object (after `freezeTokens: 0,`):
```typescript
    dailyLimitCounters: emptyDailyCounters(),
    quizzesCompleted: 0,
    lessonsCompleted: 0,
```

At the end of the file, add the two pure record helpers:
```typescript
/** Record one completed quiz (lifetime counter; feeds XP). Pure. */
export function recordQuizCompleted(p: StudyProgress): StudyProgress {
  return { ...p, quizzesCompleted: (p.quizzesCompleted ?? 0) + 1 };
}

/** Record one completed/read lesson (lifetime counter; feeds XP). Pure. */
export function recordLessonCompleted(p: StudyProgress): StudyProgress {
  return { ...p, lessonsCompleted: (p.lessonsCompleted ?? 0) + 1 };
}

/** Read the daily-limit counters, defaulting for v1 data. Pure. */
export function dailyCountersOf(p: StudyProgress): DailyLimitCounters {
  return p.dailyLimitCounters ?? emptyDailyCounters();
}
```

- [ ] **Step 5: Run to verify pass**

Run: `cd apps/poker-mobile && npx jest src/features/study/logic/__tests__/progress.test.ts`
Expected: PASS — existing tests still green (additive fields don't break `recordAnswer`/streak math), new tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/poker-mobile/src/features/study/types.ts apps/poker-mobile/src/features/study/logic/progress.ts apps/poker-mobile/src/features/study/logic/__tests__/progress.test.ts
git commit -m "feat(study): schema v2 — daily-limit counters + quiz/lesson completion counters"
```

---

## Task 4: Study store v1→v2 migration (migration-safe, quarantine preserved)

**Files:**
- Modify: `apps/poker-mobile/src/features/study/data/studyStore.ts`
- Test: `apps/poker-mobile/src/features/study/data/__tests__/studyStore.test.ts`

The store currently hard-codes `f.schemaVersion === 1` in `isValidFile`. After the v2 bump this would **quarantine every v1 payload** — wrong. Widen acceptance to `1` or `2`, and let `migrateToCurrent` stamp the current version + merge over defaults (additive fields fill in).

`@react-native-async-storage/async-storage` provides a Jest mock at `@react-native-async-storage/async-storage/jest/async-storage-mock`; existing store tests in the repo (e.g. local games) import it. Use the same pattern.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/poker-mobile/src/features/study/data/__tests__/studyStore.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadFile, saveFile, emptyFile } from '../studyStore';
import { emptyDailyCounters } from '../../logic/dailyLimits';

const KEY = 'tpoker.study.v1';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('emptyFile', () => {
  it('is schema v2 with defaulted Phase 1 fields', () => {
    const f = emptyFile();
    expect(f.schemaVersion).toBe(2);
    expect(f.progress.dailyLimitCounters).toEqual(emptyDailyCounters());
    expect(f.progress.quizzesCompleted).toBe(0);
    expect(f.progress.lessonsCompleted).toBe(0);
  });
});

describe('loadFile', () => {
  it('returns an empty v2 file when storage is empty', async () => {
    const f = await loadFile();
    expect(f.schemaVersion).toBe(2);
  });

  it('migrates a v1 payload to v2 WITHOUT quarantine, preserving existing progress', async () => {
    const v1 = {
      schemaVersion: 1,
      progress: {
        schemaVersion: 1,
        totalAnswered: 7,
        totalCorrect: 4,
        dailyGoal: 10,
        dailyCounts: { '2026-06-20': 3 },
        currentStreak: 2,
        longestStreak: 5,
      },
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(v1));

    const f = await loadFile();
    expect(f.schemaVersion).toBe(2);
    expect(f.progress.totalAnswered).toBe(7);          // preserved
    expect(f.progress.longestStreak).toBe(5);          // preserved
    expect(f.progress.dailyLimitCounters).toEqual(emptyDailyCounters()); // defaulted
    expect(f.progress.quizzesCompleted).toBe(0);       // defaulted

    // v1 payload was migrated, not quarantined.
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some(k => k.startsWith('tpoker.study.quarantine.'))).toBe(false);
  });

  it('quarantines a corrupt payload and returns an empty file', async () => {
    await AsyncStorage.setItem(KEY, '{ not json');
    const f = await loadFile();
    expect(f.schemaVersion).toBe(2);
    const keys = await AsyncStorage.getAllKeys();
    expect(keys.some(k => k.startsWith('tpoker.study.quarantine.'))).toBe(true);
    expect(await AsyncStorage.getItem(KEY)).toBeNull(); // removed after quarantine
  });

  it('round-trips a saved v2 file', async () => {
    const f = emptyFile();
    f.progress.quizzesCompleted = 3;
    f.progress.dailyLimitCounters = { quiz: { dayKey: '2026-06-25', count: 1 }, trainerSession: { dayKey: '', count: 0 } };
    await saveFile(f);
    const loaded = await loadFile();
    expect(loaded.progress.quizzesCompleted).toBe(3);
    expect(loaded.progress.dailyLimitCounters.quiz).toEqual({ dayKey: '2026-06-25', count: 1 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/poker-mobile && npx jest src/features/study/data/__tests__/studyStore.test.ts`
Expected: FAIL — the v1 migration test fails because `isValidFile` rejects `schemaVersion === 1` after the bump (it gets quarantined), and `emptyFile` assertions may already pass via Task 3 defaults but the migration assertion fails.

- [ ] **Step 3: Widen version acceptance + migration**

In `apps/poker-mobile/src/features/study/data/studyStore.ts`:

Replace `isValidFile`:
```typescript
function isValidFile(value: unknown): value is StudyFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; progress?: unknown };
  return f.schemaVersion === 1 && typeof f.progress === 'object' && f.progress !== null;
}
```
with:
```typescript
const SUPPORTED_VERSIONS = new Set([1, 2]);

function isValidFile(value: unknown): value is StudyFile {
  if (typeof value !== 'object' || value === null) return false;
  const f = value as { schemaVersion?: unknown; progress?: unknown };
  return (
    typeof f.schemaVersion === 'number' &&
    SUPPORTED_VERSIONS.has(f.schemaVersion) &&
    typeof f.progress === 'object' &&
    f.progress !== null
  );
}
```

Replace `migrateToCurrent`:
```typescript
function migrateToCurrent(parsed: StudyFile): StudyFile {
  // Identity at v1; future versions chain here. Merge against defaults defensively.
  return {
    schemaVersion: STUDY_SCHEMA_VERSION,
    progress: { ...emptyProgress(), ...parsed.progress },
  };
}
```
with:
```typescript
function migrateToCurrent(parsed: StudyFile): StudyFile {
  // v1 → v2 is purely additive: merging over emptyProgress() fills the new Phase 1 fields
  // (dailyLimitCounters, quizzesCompleted, lessonsCompleted) while preserving existing progress.
  // Always stamp the CURRENT schema version on both the file and the progress.
  return {
    schemaVersion: STUDY_SCHEMA_VERSION,
    progress: { ...emptyProgress(), ...parsed.progress, schemaVersion: STUDY_SCHEMA_VERSION },
  };
}
```

(`emptyFile` already returns `STUDY_SCHEMA_VERSION` via `emptyProgress()` — no change needed there. The storage key stays `tpoker.study.v1`; it is just a namespace string, not the schema version, so leaving it avoids orphaning existing data.)

- [ ] **Step 4: Run to verify pass**

Run: `cd apps/poker-mobile && npx jest src/features/study/data/__tests__/studyStore.test.ts`
Expected: PASS — migration, quarantine, and round-trip all green.

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/features/study/data/studyStore.ts apps/poker-mobile/src/features/study/data/__tests__/studyStore.test.ts
git commit -m "feat(study): v1->v2 store migration (additive, quarantine preserved) + tests"
```

---

## Task 5: StudyContext — expose limit reads, consume, and completion records

**Files:**
- Modify: `apps/poker-mobile/src/features/study/state/StudyContext.tsx`

The context is the single write path (serialized via `writeQueue`). Add: a `limitFor(kind)` read (uses `useEntitlements().isPremium`), a `consumeLimit(kind)` write, and `recordQuizCompleted`/`recordLessonCompleted` writes. No new test file (this is thin React glue over already-tested pure logic; screens are exercised manually + the pure logic is covered in Tasks 2–3). Type-check is the gate.

- [ ] **Step 1: Extend the context type and imports**

Add imports (with the existing logic imports):
```typescript
import { recordQuizCompleted as applyQuizDone, recordLessonCompleted as applyLessonDone, dailyCountersOf } from '../logic/progress';
import { limitStatus, consumeToday, type DailyLimitKind, type LimitStatus } from '../logic/dailyLimits';
```

Extend `StudyContextType` (add after `setDailyGoal`):
```typescript
  /** Whether one more metered free rep is allowed today + how many remain (premium ⇒ Infinity). */
  limitFor: (kind: DailyLimitKind) => LimitStatus;
  /** Record one metered rep for today (date-stamped; resets on a new local day). */
  consumeLimit: (kind: DailyLimitKind) => Promise<void>;
  /** Record one completed quiz (feeds XP). */
  recordQuizCompleted: () => Promise<void>;
  /** Record one completed/read lesson (feeds XP). */
  recordLessonCompleted: () => Promise<void>;
```

Extend the default context object passed to `createContext` with no-op/Infinity defaults:
```typescript
  limitFor: () => ({ allowed: true, remaining: Infinity }),
  consumeLimit: async () => {},
  recordQuizCompleted: async () => {},
  recordLessonCompleted: async () => {},
```

- [ ] **Step 2: Implement the new callbacks in `StudyProvider`**

Add after the existing `setDailyGoal` callback (note `isPremium` is already in scope from `useEntitlements()`):
```typescript
  const limitFor = useCallback(
    (kind: DailyLimitKind): LimitStatus =>
      limitStatus(dailyCountersOf(file.progress), kind, todayKey(), isPremium),
    [file.progress, isPremium],
  );

  const consumeLimit = useCallback(async (kind: DailyLimitKind) => {
    const counters = consumeToday(dailyCountersOf(file.progress), kind, todayKey());
    await commit({ ...file, progress: { ...file.progress, dailyLimitCounters: counters } });
  }, [file, commit]);

  const recordQuizCompleted = useCallback(async () => {
    await commit({ ...file, progress: applyQuizDone(file.progress) });
  }, [file, commit]);

  const recordLessonCompleted = useCallback(async () => {
    await commit({ ...file, progress: applyLessonDone(file.progress) });
  }, [file, commit]);
```

Add all four to the provider's `value` object:
```typescript
    <StudyContext.Provider value={{ progress: file.progress, dataset: STARTER_DATASET, isLoaded, recordAnswer, setDailyGoal, limitFor, consumeLimit, recordQuizCompleted, recordLessonCompleted }}>
```

- [ ] **Step 3: Type-check**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run the study test suite (no regressions)**

Run: `cd apps/poker-mobile && npx jest src/features/study`
Expected: PASS — dailyLimits, progress, studyStore, quizIngest all green.

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/features/study/state/StudyContext.tsx
git commit -m "feat(study): StudyContext exposes daily-limit reads/consume + completion records"
```

---

## Task 6: Shared flag-adaptive lock/limit affordance component

**Files:**
- Create: `apps/poker-mobile/src/features/study/ui/LockNudge.tsx`

One consistent component (spec §11: "one consistent Soon chip + lock affordance across Study/paywall/landing") for both "daily limit reached" and "pack locked" cases, used by Quiz/Trainer/Lessons/Study screens. It is **flag-adaptive**: with `paywall` OFF it shows honest copy and NO purchase path; with `paywall` ON it renders the Upgrade CTA → `Paywall`. All tokens come from the theme; icon is an Ionicon (no emoji); the CTA reuses `PrimaryButton`. a11y: the whole card has `accessibilityRole="summary"` text; the CTA is a 44x44+ `PrimaryButton` with an explicit label; lock state is conveyed by icon + text, never color alone.

- [ ] **Step 1: Create the component**

```typescript
// apps/poker-mobile/src/features/study/ui/LockNudge.tsx
/**
 * Flag-adaptive lock / daily-limit affordance (Phase 1). ONE consistent surface for "daily free
 * limit reached" and "premium pack locked". HONESTY GATE: when the `paywall` flag is OFF there is
 * NO purchase path — only honest "coming soon" copy. When ON, it routes to the live PaywallScreen
 * (built in Subsystem 3). Lock state is conveyed by icon + text (never color alone).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../../components/Card';
import PrimaryButton from '../../../components/PrimaryButton';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';
import { isFeatureEnabled } from '../../../config/features';
import type { RootStackParamList } from '../../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface LockNudgeProps {
  /** Heading, e.g. "Daily free limit reached" or "Premium pack". */
  title: string;
  /** Honest body shown when paywall is OFF (no purchase path). */
  comingSoonBody: string;
  /** Body shown above the Upgrade CTA when paywall is ON. */
  upgradeBody: string;
  /** Analytics/routing context passed to Paywall. */
  trigger: string;
  /** Icon — defaults to a lock. */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}

export default function LockNudge({ title, comingSoonBody, upgradeBody, trigger, icon = 'lock-closed' }: LockNudgeProps) {
  const navigation = useNavigation<Nav>();
  const paywallOn = isFeatureEnabled('paywall');
  const body = paywallOn ? upgradeBody : comingSoonBody;

  return (
    <Card style={styles.card} accessible accessibilityRole="summary" accessibilityLabel={`${title}. ${body}`}>
      <View style={styles.head}>
        <Ionicons name={icon} size={18} color={colors.gold} />
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
      {paywallOn && (
        <View style={styles.cta}>
          <PrimaryButton
            label="See Premium"
            variant="gradient"
            onPress={() => navigation.navigate('Paywall', { trigger })}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h4, color: colors.text },
  body: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  cta: { marginTop: spacing.sm },
});
```

Honest copy the screens will pass (spec §4):
- Limit reached `comingSoonBody`: `"Daily free limit reached — resets tomorrow. Premium (unlimited) coming soon."`
- Limit reached `upgradeBody`: `"You’ve used today’s free reps. Go unlimited with Premium."`
- Pack locked `comingSoonBody`: `"This pack is part of Premium — coming soon. The 4 free packs are open now."`
- Pack locked `upgradeBody`: `"This pack is part of Premium. Unlock the full library."`

- [ ] **Step 2: Type-check**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/poker-mobile/src/features/study/ui/LockNudge.tsx
git commit -m "feat(study): shared flag-adaptive LockNudge (honest when paywall OFF, CTA when ON)"
```

---

## Task 7: Gate QuizRunnerScreen — 1 free quiz/day, free-only content, remaining indicator, completion record

**Files:**
- Modify: `apps/poker-mobile/src/features/study/ui/QuizRunnerScreen.tsx`

Behavior:
1. On `pick`, read `limitFor('quiz')`. If a free user has 0 remaining, render `LockNudge` instead of the "Start quiz" path; do not allow starting.
2. Show a remaining-count indicator in the hero ("1 free quiz left today" / unlimited for premium) — text + icon, not color-only.
3. Restrict the free user's question pool to free rows via `selectQuestions({ freeOnly: true })` (premium gets all).
4. On entering `results` (quiz finished), call `consumeLimit('quiz')` + `recordQuizCompleted()` + `track('study_quiz_completed', ...)` exactly once.

- [ ] **Step 1: Add imports and hooks**

Add imports:
```typescript
import { useEntitlements } from '../../../context/EntitlementsContext';
import { useStudy } from '../state/StudyContext';
import { track } from '../../../utils/analytics';
import LockNudge from './LockNudge';
import Chip from '../../../components/Chip';
```
(`Chip` is already imported — do not duplicate; verify before adding.)

In the component body, after the existing `mastery` line:
```typescript
  const { isPremium } = useEntitlements();
  const { limitFor, consumeLimit, recordQuizCompleted } = useStudy();
  const quizLimit = limitFor('quiz');
```

- [ ] **Step 2: Apply free-only filtering in `startRun`**

Change `selectQuestions` call:
```typescript
    const pool = selectQuestions(all ?? [], { category: cat ?? undefined, limit: RUN_LIMIT });
```
to:
```typescript
    const pool = selectQuestions(all ?? [], { category: cat ?? undefined, freeOnly: !isPremium, limit: RUN_LIMIT });
```

- [ ] **Step 3: Record completion + consume on finishing (once)**

The run finishes in two places (`answer`'s last question via `next`, and `next` setting `phase='results'`). Centralize: change `next` so that when it transitions to results it fires the side effects.

Replace:
```typescript
  const next = () => {
    if (idx + 1 >= run.length) { setPhase('results'); return; }
    setIdx(idx + 1);
    setChosen(null);
  };
```
with:
```typescript
  const finishQuiz = () => {
    setPhase('results');
    const score = scoreQuiz(outcomes);
    track('study_quiz_completed', { category: category ?? 'all', total: score.total, pct: score.pct });
    void consumeLimit('quiz');
    void recordQuizCompleted();
  };

  const next = () => {
    if (idx + 1 >= run.length) { finishQuiz(); return; }
    setIdx(idx + 1);
    setChosen(null);
  };
```
(`scoreQuiz` is already imported.)

- [ ] **Step 4: Block start + show remaining in `PickView`**

Pass the limit into `PickView`. Change the `PickView` render in the `phase === 'pick'` branch:
```typescript
          {phase === 'pick' ? (
            <PickView
              total={all?.length ?? 0}
              categories={categories}
              limit={quizLimit}
              onStartAll={() => startRun(null)}
              onStartCategory={(c) => startRun(c)}
            />
          ) : phase === 'run' ? (
```

Update `PickView`'s signature + body. Replace the function with:
```typescript
function PickView({ total, categories, limit, onStartAll, onStartCategory }: {
  total: number; categories: string[]; limit: { allowed: boolean; remaining: number };
  onStartAll: () => void; onStartCategory: (c: string) => void;
}) {
  const blocked = !limit.allowed;
  const remainingLabel = limit.remaining === Infinity ? 'Unlimited quizzes' : `${limit.remaining} free quiz${limit.remaining === 1 ? '' : 'zes'} left today`;
  return (
    <>
      <Card variant="hero">
        <Text style={styles.heroLabel}>QUESTION BANK</Text>
        <Text style={styles.heroNum}>{total}</Text>
        <Text style={styles.heroSub}>Up to {RUN_LIMIT} questions per run · educational, not solver output</Text>
        <View style={styles.limitChipRow}>
          <Chip label={remainingLabel} tone={limit.remaining === Infinity ? 'gold' : 'neutral'} icon="time-outline" />
        </View>
        {!blocked && (
          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="Start quiz" variant="gradient" onPress={onStartAll} />
          </View>
        )}
      </Card>

      {blocked && (
        <LockNudge
          title="Daily free limit reached"
          comingSoonBody="Daily free limit reached — resets tomorrow. Premium (unlimited) coming soon."
          upgradeBody="You’ve used today’s free quiz. Go unlimited with Premium."
          trigger="quiz_daily_limit"
          icon="time-outline"
        />
      )}

      {!blocked && categories.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BY CATEGORY</Text>
          {categories.map(c => (
            <PressableScale key={c} haptic="light" accessibilityRole="button" accessibilityLabel={`Start ${c} quiz`} onPress={() => onStartCategory(c)}>
              <Card style={styles.row}>
                <View style={styles.icon}><Ionicons name="albums-outline" size={20} color={colors.gold} /></View>
                <Text style={styles.rowName}>{c}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Card>
            </PressableScale>
          ))}
        </View>
      )}
    </>
  );
}
```

Add the one new style to the `StyleSheet.create({...})`:
```typescript
  limitChipRow: { marginTop: spacing.sm, flexDirection: 'row' },
```

- [ ] **Step 5: Type-check + manual reasoning gate**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS. Verify by reading: a free user with `quizLimit.allowed === false` sees `LockNudge` and no "Start quiz"; premium sees "Unlimited quizzes" and may always start.

- [ ] **Step 6: Run study tests (no regressions)**

Run: `cd apps/poker-mobile && npx jest src/features/study`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/poker-mobile/src/features/study/ui/QuizRunnerScreen.tsx
git commit -m "feat(study): gate free daily quiz (1/day, free-pack content) + remaining indicator + completion XP"
```

---

## Task 8: Gate SpotTrainerScreen — 3 free sessions/day, remaining indicator, flag-adaptive nudge

**Files:**
- Modify: `apps/poker-mobile/src/features/study/ui/SpotTrainerScreen.tsx`

Behavior: a "session" is a started Spot Trainer run. Read `limitFor('trainerSession')` on mount. If a free user has 0 remaining, render a blocked state (header + `LockNudge`) instead of the spot UI, and do not generate spots. When allowed, consume one session at the start of the session (in the existing mount `useEffect` that already fires `study_trainer_started`), and show a remaining-count indicator. Premium is unlimited. Note `mode === 'spot'` is the metered Spot Trainer; the continuous `'decision'` mode is also metered (both are trainer sessions per spec — "Spot Trainer sessions/day"); gate both for consistency.

- [ ] **Step 1: Add imports + hooks + blocked state**

Add imports:
```typescript
import { useEntitlements } from '../../../context/EntitlementsContext';
import LockNudge from './LockNudge';
import Chip from '../../../components/Chip';
```

In the component, after `const { dataset, recordAnswer } = useStudy();`, widen the destructure and read entitlement + limit:
```typescript
  const { dataset, recordAnswer, limitFor, consumeLimit } = useStudy();
  const { isPremium } = useEntitlements();
  const sessionLimit = limitFor('trainerSession');
  const [blocked] = useState(!sessionLimit.allowed);
```
(Reading the limit once at mount — `blocked` is captured at session start so a mid-session consume doesn't yank the UI. `consumeLimit` runs in the mount effect below.)

- [ ] **Step 2: Consume one session at start (free users)**

Replace the existing mount effect:
```typescript
  useEffect(() => {
    track('study_trainer_started', { mode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```
with:
```typescript
  useEffect(() => {
    if (blocked) return; // do not start or consume a session the user can't run
    track('study_trainer_started', { mode });
    void consumeLimit('trainerSession');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

- [ ] **Step 3: Render the blocked state early**

Immediately before the existing `if (done) {` block, add:
```typescript
  if (blocked) {
    return (
      <Screen>
        <BrandHeader variant="screen" title={isQuiz ? 'Spot Trainer' : 'Decision Trainer'} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <LockNudge
            title="Daily free limit reached"
            comingSoonBody="Daily free limit reached — resets tomorrow. Premium (unlimited) coming soon."
            upgradeBody="You’ve used today’s free trainer sessions. Go unlimited with Premium."
            trigger="trainer_daily_limit"
            icon="time-outline"
          />
        </View>
      </Screen>
    );
  }
```

- [ ] **Step 4: Show the remaining-session indicator in the active header**

In the main `return`, add a chip under the stats strip area. Inside `<View style={styles.body}>`, immediately after the opening, add:
```typescript
        <View style={styles.limitRow}>
          <Chip
            label={sessionLimit.remaining === Infinity ? 'Unlimited sessions' : `${sessionLimit.remaining} free session${sessionLimit.remaining === 1 ? '' : 's'} left today`}
            tone={sessionLimit.remaining === Infinity ? 'gold' : 'neutral'}
            icon="time-outline"
          />
        </View>
```
Add the style to the `StyleSheet.create`:
```typescript
  limitRow: { flexDirection: 'row' },
```

- [ ] **Step 5: Type-check**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS. Verify by reading: a free user who already ran 3 sessions today lands directly on the blocked state; otherwise the session starts, consumes one, and shows the remaining count.

- [ ] **Step 6: Run study tests (no regressions)**

Run: `cd apps/poker-mobile && npx jest src/features/study`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/poker-mobile/src/features/study/ui/SpotTrainerScreen.tsx
git commit -m "feat(study): gate free Spot Trainer (3 sessions/day) + remaining indicator + flag-adaptive nudge"
```

---

## Task 9: Surface free/premium pack lock states in LessonModulesScreen + record lesson completion

**Files:**
- Modify: `apps/poker-mobile/src/features/study/ui/LessonModulesScreen.tsx`
- Modify: `apps/poker-mobile/src/features/study/ui/LessonReaderScreen.tsx`

`learning_modules` rows do not carry a pack-access field directly, but the spec requires lock states surfaced in the module list (4 unlocked / 8 locked). Approach: join modules to pack access via the catalog the same way `PackCatalogScreen` does — load `pack_manifests` + `premium_content_catalog`, build the catalog, and resolve module→pack by the module's `PackID` column when present. Modules with a locked premium pack get a lock chip + route to `LockNudge`-style handling; available ones open the reader. Lessons are **unmetered** for free packs (spec §6) — no daily limit here; completion only feeds XP.

`learning_modules` rows include a `PackID` field in the bundled content (confirmed shape: catalog/manifest are keyed by `PackID`). If a module has no `PackID` or the pack is free, treat it as available (fail-OPEN for lessons is acceptable since lessons are not sold individually and the daily quiz/trainer remain the metered surfaces; premium packs are still locked by their catalog row).

- [ ] **Step 1: LessonModulesScreen — load catalog + compute per-module availability**

Add imports:
```typescript
import { View, Text } from 'react-native'; // extend the existing RN import
import { Ionicons } from '@expo/vector-icons';
import Chip from '../../../components/Chip';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { buildPackCatalog, availabilityOf, packById, type Pack } from '../../premium/logic/marketableLabel';
import { colors } from '../../../theme/colors';
```
(Merge `View, Text` into the existing `import { ScrollView, StyleSheet } from 'react-native';` line rather than duplicating.)

Add state + entitlement and load packs alongside modules. Replace the existing data effect with a `Promise.all` that also loads the catalog:
```typescript
  const { isPremium } = useEntitlements();
  const [packs, setPacks] = useState<Pack[]>([]);

  useEffect(() => {
    if (!isLoaded || !query) return;
    let cancelled = false;
    setError(false);
    setModules(null);
    Promise.all([
      query.all('learning_modules'),
      query.all('pack_manifests'),
      query.all('premium_content_catalog'),
    ])
      .then(([moduleRows, manifests, catalog]) => {
        if (cancelled) return;
        setModules(toModules(moduleRows));
        setPacks(buildPackCatalog(manifests, catalog));
        // keep PackID accessible: stash raw rows for the join
        setModulePackIds(Object.fromEntries(moduleRows.map(r => [String(r['ModuleID'] ?? ''), String(r['PackID'] ?? '')])));
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [isLoaded, query, reloadKey]);
```
Add the supporting state near the other `useState`s:
```typescript
  const [modulePackIds, setModulePackIds] = useState<Record<string, string>>({});
```

- [ ] **Step 2: Compute availability per row and render lock affordance**

Add a helper inside the component (before `return`):
```typescript
  const availabilityForModule = (moduleId: string) => {
    const packId = modulePackIds[moduleId];
    if (!packId) return 'available' as const;
    const pack = packById(packs, packId);
    return pack ? availabilityOf(pack, isPremium) : ('available' as const);
  };
```

Replace the `ListRow` rendering with lock-aware rows:
```typescript
          {(modules ?? []).map(m => {
            const availability = availabilityForModule(m.moduleId);
            const locked = availability === 'locked';
            const comingSoon = availability === 'coming_soon';
            return (
              <ListRow
                key={m.moduleId}
                icon="book-outline"
                title={m.moduleName || m.moduleId}
                titleLines={2}
                dim={comingSoon}
                onPress={() =>
                  locked
                    ? navigation.navigate('Paywall', { trigger: 'lesson_locked' })
                    : comingSoon
                      ? undefined
                      : navigation.navigate('LessonReader', { moduleId: m.moduleId, moduleName: m.moduleName })
                }
                accessibilityLabel={`Open lesson module ${m.moduleName || m.moduleId}${locked ? ', premium locked' : comingSoon ? ', coming soon' : ''}`}
                titleRight={
                  locked ? <Ionicons name="lock-closed" size={16} color={colors.gold} />
                  : comingSoon ? <Chip label="Soon" tone="neutral" />
                  : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                }
              />
            );
          })}
```

Note: the `paywall`-OFF honesty is preserved because the `Paywall` route itself renders honest "Soon" chips when `paywall` is OFF (Subsystem 3 owns that screen). For a fully honest P1-only build where `Paywall` may be inert, locked taps simply navigate to that screen which shows the coming-soon state — no charge path. (If desired, gate the navigate on `isFeatureEnabled('paywall')` and otherwise no-op; keep the lock icon either way.)

- [ ] **Step 3: LessonReaderScreen — record completion (feeds XP)**

Add import + hook and fire `recordLessonCompleted` once when sections load successfully (a read = a completion for XP purposes at this stage; honest because lessons are short single-screen reads).

Add imports:
```typescript
import { useStudy } from '../state/StudyContext';
import { track } from '../../../utils/analytics';
```
Add hook in the component:
```typescript
  const { recordLessonCompleted } = useStudy();
```
In the data effect, after `setSections(sortSections(rows))`, fire completion when there is real content:
```typescript
      .then(rows => {
        if (cancelled) return;
        const secs = sortSections(rows);
        setSections(secs);
        if (secs.length > 0) {
          track('study_lesson_completed', { module_id: moduleId });
          void recordLessonCompleted();
        }
      })
```

- [ ] **Step 4: Type-check**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/features/study/ui/LessonModulesScreen.tsx apps/poker-mobile/src/features/study/ui/LessonReaderScreen.tsx
git commit -m "feat(study): lesson module lock chips via pack access + lesson-completion XP"
```

---

## Task 10: StudyScreen — free/premium library summary (4 unlocked / 8 locked)

**Files:**
- Modify: `apps/poker-mobile/src/features/study/ui/StudyScreen.tsx`

Add a concise "Library" summary card to Study home showing how many packs are unlocked vs locked for this entitlement, with a flag-adaptive CTA (`paywall` OFF → honest "X premium packs coming soon" text, no button; ON → "See Premium" button). This is the spec's "surface lock states in Study home" requirement.

`StudyScreen` does not currently load content. Add a lazy `useContent` + catalog load (non-blocking; the card simply doesn't render until packs resolve). Reuse `availabilityOf`.

- [ ] **Step 1: Add imports + load the catalog**

Add imports:
```typescript
import { useContent } from '../../../context/ContentContext';
import { useEntitlements } from '../../../context/EntitlementsContext';
import { buildPackCatalog, availabilityOf, type Pack } from '../../premium/logic/marketableLabel';
import LockNudge from './LockNudge';
```

In the component, add state + load (after the existing hooks):
```typescript
  const { isLoaded: contentLoaded, query } = useContent();
  const { isPremium } = useEntitlements();
  const [packs, setPacks] = useState<Pack[] | null>(null);

  useEffect(() => {
    if (!contentLoaded || !query) return;
    let cancelled = false;
    Promise.all([query.all('pack_manifests'), query.all('premium_content_catalog')])
      .then(([m, c]) => { if (!cancelled) setPacks(buildPackCatalog(m, c)); })
      .catch(() => { if (!cancelled) setPacks([]); });
    return () => { cancelled = true; };
  }, [contentLoaded, query]);
```
Add `useState`/`useEffect` to the React import if not present (the file currently imports only `React`); change to:
```typescript
import React, { useEffect, useState } from 'react';
```

- [ ] **Step 2: Compute counts + render the summary card**

Before `return`, compute:
```typescript
  const lockedCount = (packs ?? []).filter(p => availabilityOf(p, isPremium) === 'locked').length;
  const unlockedCount = (packs ?? []).filter(p => availabilityOf(p, isPremium) === 'available').length;
  const showLibrary = isFeatureEnabled('content') && packs !== null && (lockedCount > 0 || unlockedCount > 0);
```

Render a card in the `TRAIN`/sections area (insert just above the existing `<View style={styles.section}>` that holds the TRAIN CTAs). Use the existing `SectionTitle` + `Card`:
```typescript
        {showLibrary && (
          <View style={styles.section}>
            <SectionTitle>LIBRARY</SectionTitle>
            <Card>
              <View style={styles.libRow}>
                <Ionicons name="lock-open-outline" size={18} color={colors.success} />
                <Text style={styles.libText}>{unlockedCount} pack{unlockedCount === 1 ? '' : 's'} unlocked</Text>
              </View>
              {lockedCount > 0 && (
                <View style={styles.libRow}>
                  <Ionicons name="lock-closed" size={18} color={colors.gold} />
                  <Text style={styles.libText}>{lockedCount} premium pack{lockedCount === 1 ? '' : 's'} {isFeatureEnabled('paywall') ? 'locked' : 'coming soon'}</Text>
                </View>
              )}
            </Card>
            {lockedCount > 0 && (
              <LockNudge
                title={isFeatureEnabled('paywall') ? 'Unlock the full library' : 'More packs on the way'}
                comingSoonBody="The 4 free packs are open now. Premium unlocks the full library — coming soon."
                upgradeBody="Unlock every study pack, all quizzes, and unlimited Spot Trainer."
                trigger="study_home_library"
                icon="library-outline"
              />
            )}
          </View>
        )}
```

Add the styles to `StyleSheet.create`:
```typescript
  libRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  libText: { ...typography.body, color: colors.textHigh },
```

- [ ] **Step 3: Type-check**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/poker-mobile/src/features/study/ui/StudyScreen.tsx
git commit -m "feat(study): Study home library summary (unlocked/locked packs) + flag-adaptive nudge"
```

---

## Task 11: Quiz/lesson completion XP wiring (engagement, TDD)

**Files:**
- Modify: `apps/poker-mobile/src/utils/analytics.ts`
- Modify: `apps/poker-mobile/src/features/engagement/types.ts`
- Modify: `apps/poker-mobile/src/features/engagement/logic/xp.ts`
- Test: `apps/poker-mobile/src/features/engagement/logic/__tests__/xp.test.ts`
- Modify: `apps/poker-mobile/src/features/engagement/state/EngagementContext.tsx`

XP is derived from signals. Spot answers already feed `spotsAnswered`. This task adds two new signals (`quizzesCompleted`, `lessonsCompleted`) with weights, and derives them from study progress in `EngagementContext`.

- [ ] **Step 1: Add the analytics events (type-only; no behavior)**

In `apps/poker-mobile/src/utils/analytics.ts`, add to the `AnalyticsEvent` union (after `'study_trainer_finished'`):
```typescript
  | 'study_quiz_completed'
  | 'study_lesson_completed'
```

- [ ] **Step 2: Write the failing XP test**

Append to `apps/poker-mobile/src/features/engagement/logic/__tests__/xp.test.ts`:
```typescript
describe('computeXp — quiz/lesson completion signals', () => {
  it('weights quizzesCompleted and lessonsCompleted', () => {
    const s: EngagementSignals = { ...base, quizzesCompleted: 2, lessonsCompleted: 3 };
    const expected = 2 * XP_WEIGHTS.quizCompleted + 3 * XP_WEIGHTS.lessonCompleted;
    expect(computeXp(s, 0)).toBe(expected);
  });

  it('adds completion XP on top of spot XP', () => {
    const s: EngagementSignals = { ...base, spotsAnswered: 5, quizzesCompleted: 1, lessonsCompleted: 1 };
    const expected = 5 * XP_WEIGHTS.spot + 1 * XP_WEIGHTS.quizCompleted + 1 * XP_WEIGHTS.lessonCompleted;
    expect(computeXp(s, 0)).toBe(expected);
  });
});
```
Also update the shared `base` fixture at the top of the file to include the new signal fields:
```typescript
const base: EngagementSignals = {
  spotsAnswered: 0, studyStreak: 0, bankrollSessions: 0,
  bankrollPositiveMonth: false, coachAnalyses: 0, localGamesFinished: 0,
  quizzesCompleted: 0, lessonsCompleted: 0,
};
```

- [ ] **Step 3: Run to verify failure**

Run: `cd apps/poker-mobile && npx jest src/features/engagement/logic/__tests__/xp.test.ts`
Expected: FAIL — `XP_WEIGHTS.quizCompleted`/`lessonCompleted` undefined; `EngagementSignals` missing fields.

- [ ] **Step 4: Add signals + weights**

In `apps/poker-mobile/src/features/engagement/types.ts`, add to `EngagementSignals` (after `localGamesFinished: number;`):
```typescript
  quizzesCompleted: number;
  lessonsCompleted: number;
```

In `apps/poker-mobile/src/features/engagement/logic/xp.ts`, add to `XP_WEIGHTS` (after `achievement: 25,`):
```typescript
  quizCompleted: 8,
  lessonCompleted: 6,
```
And add their contribution in `computeXp` (inside the returned sum, before the achievements term):
```typescript
    s.quizzesCompleted * XP_WEIGHTS.quizCompleted +
    s.lessonsCompleted * XP_WEIGHTS.lessonCompleted +
```

- [ ] **Step 5: Run to verify pass**

Run: `cd apps/poker-mobile && npx jest src/features/engagement/logic/__tests__/xp.test.ts`
Expected: PASS.

- [ ] **Step 6: Derive the new signals in EngagementContext**

In `apps/poker-mobile/src/features/engagement/state/EngagementContext.tsx`:

After the existing `const spotsAnswered = progress.totalAnswered;` line, add:
```typescript
  const quizzesCompleted = progress.quizzesCompleted ?? 0;
  const lessonsCompleted = progress.lessonsCompleted ?? 0;
```

Add them to the `signals` memo object and its dependency array:
```typescript
  const signals: EngagementSignals = useMemo(() => ({
    spotsAnswered, studyStreak, bankrollSessions, bankrollPositiveMonth, coachAnalyses, localGamesFinished,
    quizzesCompleted, lessonsCompleted,
  }), [spotsAnswered, studyStreak, bankrollSessions, bankrollPositiveMonth, coachAnalyses, localGamesFinished, quizzesCompleted, lessonsCompleted]);
```

Update the fallback signals object in `useEngagement()` (the no-provider branch) to include the new fields:
```typescript
      rank: rankForXp(0), signals: {
        spotsAnswered: 0, studyStreak: 0, bankrollSessions: 0,
        bankrollPositiveMonth: false, coachAnalyses: 0, localGamesFinished: 0,
        quizzesCompleted: 0, lessonsCompleted: 0,
      },
```

- [ ] **Step 7: Type-check + full engagement tests**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS.
Run: `cd apps/poker-mobile && npx jest src/features/engagement`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/poker-mobile/src/utils/analytics.ts apps/poker-mobile/src/features/engagement/types.ts apps/poker-mobile/src/features/engagement/logic/xp.ts apps/poker-mobile/src/features/engagement/logic/__tests__/xp.test.ts apps/poker-mobile/src/features/engagement/state/EngagementContext.tsx
git commit -m "feat(engagement): quiz/lesson completion feeds XP (new signals + weights, TDD)"
```

---

## Task 12: Flip flags ON in PROD_FLAGS + honesty CI guard test

**Files:**
- Modify: `apps/poker-mobile/src/config/features.ts`
- Test: `apps/poker-mobile/src/config/__tests__/features.prodFlags.test.ts`

Flip `study`, `content`, `retention` ON in production; keep `paywall`, `coach`, `solver`, `mastery` OFF (spec §6). Add a jest test asserting the exact launch state so a stray flip is caught in CI.

The test must read `PROD_FLAGS`, not the resolved object (which is dev-overridden). `PROD_FLAGS` is not currently exported — export it.

- [ ] **Step 1: Write the failing guard test**

```typescript
// apps/poker-mobile/src/config/__tests__/features.prodFlags.test.ts
import { PROD_FLAGS } from '../features';

/**
 * Honesty + launch-state CI guard (spec §6, §10). Phase 1 turns the free training taste ON in
 * production; the paid/unsafe flags stay OFF. A stray flip here changes what real users see, so we
 * pin the exact production flag matrix.
 */
describe('PROD_FLAGS — Phase 1 launch state', () => {
  it('turns the free training taste ON', () => {
    expect(PROD_FLAGS.study).toBe(true);
    expect(PROD_FLAGS.content).toBe(true);
    expect(PROD_FLAGS.retention).toBe(true);
  });

  it('keeps paid/unsafe surfaces OFF (paywall is Subsystem 3)', () => {
    expect(PROD_FLAGS.paywall).toBe(false);
    expect(PROD_FLAGS.coach).toBe(false);
    expect(PROD_FLAGS.solver).toBe(false);
    expect(PROD_FLAGS.mastery).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/poker-mobile && npx jest src/config/__tests__/features.prodFlags.test.ts`
Expected: FAIL — `PROD_FLAGS` is not exported (import is `undefined`), and `study/content/retention` are still `false`.

- [ ] **Step 3: Export PROD_FLAGS and flip the three flags**

In `apps/poker-mobile/src/config/features.ts`:

Change the declaration to export it:
```typescript
const PROD_FLAGS: Record<FeatureFlag, boolean> = {
```
to:
```typescript
export const PROD_FLAGS: Record<FeatureFlag, boolean> = {
```

Within `PROD_FLAGS`, flip exactly these three:
```typescript
  study: true,
  content: true,
  retention: true,
```
Leave `paywall: false`, `coach: false`, `solver: false`, `mastery: false` unchanged. Do not change `BETA_FLAGS` or `DEV_OVERRIDES`.

- [ ] **Step 4: Run to verify pass**

Run: `cd apps/poker-mobile && npx jest src/config/__tests__/features.prodFlags.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/config/features.ts apps/poker-mobile/src/config/__tests__/features.prodFlags.test.ts
git commit -m "feat(flags): turn study/content/retention ON in prod (paywall/coach/solver/mastery stay OFF) + CI guard"
```

---

## Task 13: a11y pass on new/changed Study surfaces

**Files:**
- Modify: `apps/poker-mobile/src/features/study/ui/LockNudge.tsx`
- Modify: `apps/poker-mobile/src/features/study/ui/QuizRunnerScreen.tsx`
- Modify: `apps/poker-mobile/src/features/study/ui/SpotTrainerScreen.tsx`
- Modify: `apps/poker-mobile/src/features/study/ui/LessonModulesScreen.tsx`
- Modify: `apps/poker-mobile/src/features/study/ui/StudyScreen.tsx`

Apply the spec §11 a11y priority order to everything added in Tasks 6–10. Most tokens/components are already compliant (Velvet Table tokens, `PressableScale`, `PrimaryButton`, `Ionicons`); this task closes the explicit gaps. No new tests (a11y is verified by manual screen-reader/reduced-motion pass + the `expo export` gate); each step is a concrete assertion to satisfy by reading/adjusting the code.

- [ ] **Step 1: Never color-only for limit/lock state**

Verify each limit/lock chip pairs an Ionicon + text with the color (already done via `icon="time-outline"` / `lock-closed` + label). Confirm the quiz option feedback and spot feedback already use icon + text (they do: checkmark/close icons + "Correct"/"Not quite" text) — no change, but confirm by reading. Record the confirmation in the commit message.

- [ ] **Step 2: SR labels on the remaining-count indicators**

Add `accessibilityLabel` to the quiz + trainer remaining chips so screen readers announce intent, not just the truncated chip text. In `QuizRunnerScreen` `PickView`, wrap the remaining `Chip` is unnecessary (Chip renders Text); instead set an explicit label on the hero block:
```typescript
        <View style={styles.limitChipRow} accessible accessibilityLabel={limit.remaining === Infinity ? 'Unlimited quizzes with Premium' : `${remainingLabel}`}>
          <Chip label={remainingLabel} tone={limit.remaining === Infinity ? 'gold' : 'neutral'} icon="time-outline" />
        </View>
```
Do the same for the `SpotTrainerScreen` `limitRow`:
```typescript
        <View style={styles.limitRow} accessible accessibilityLabel={sessionLimit.remaining === Infinity ? 'Unlimited trainer sessions with Premium' : `${sessionLimit.remaining} free trainer sessions left today`}>
```

- [ ] **Step 3: 44x44 touch targets**

Confirm every tappable element added uses `PressableScale`/`PrimaryButton`/`ListRow` (all already meet ≥44x44). The `LockNudge` CTA is a `PrimaryButton` (compliant). No raw `TouchableOpacity` with small hit areas was added — confirm by reading. The lock chips are non-interactive (display only) — correct.

- [ ] **Step 4: prefers-reduced-motion**

No new animations were introduced in Tasks 6–10 (LockNudge/cards are static; `PressableScale` already honors platform motion; `Celebration` in SpotTrainer is unchanged). Confirm no `entering`/layout animation was added to the blocked states. Record confirmation.

- [ ] **Step 5: Semantic tokens only (no raw hex), SVG icons (no emoji), Avatars via component**

Grep the changed files for raw hex and emoji to confirm none were introduced.

Run: `cd apps/poker-mobile && npx jest --version >$null; rg -n "#[0-9a-fA-F]{3,6}" src/features/study/ui/LockNudge.tsx src/features/study/ui/StudyScreen.tsx`
Expected: any hits are pre-existing (e.g. `StudyScreen` already had `fontSize: 11` style values and the streak flame emoji `🔥` predates this work — do NOT add new emoji; the existing flame is out of scope). New code in `LockNudge` must show **zero** hex matches. If a new hex slipped in, replace it with a `colors.*` token.

- [ ] **Step 6: Type-check + commit**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS.

```bash
git add apps/poker-mobile/src/features/study/ui/LockNudge.tsx apps/poker-mobile/src/features/study/ui/QuizRunnerScreen.tsx apps/poker-mobile/src/features/study/ui/SpotTrainerScreen.tsx apps/poker-mobile/src/features/study/ui/LessonModulesScreen.tsx apps/poker-mobile/src/features/study/ui/StudyScreen.tsx
git commit -m "a11y(study): SR labels on limit indicators; confirm tokens-only, icon+text feedback, no new motion"
```

---

## Task 14: Final gates (full suite, type-check, web export)

**Files:** none (verification only).

- [ ] **Step 1: Type-check the whole app**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 2: Full Jest suite**

Run: `cd apps/poker-mobile && npx jest`
Expected: PASS — all suites, including the unchanged settlement-engine fixtures (must stay byte-equivalent — this work does not touch money math), plus the new `dailyLimits`, `studyStore`, `progress`, `xp`, and `features.prodFlags` suites.

- [ ] **Step 3: Web export (build gate)**

Run: `cd apps/poker-mobile && npx expo export -p web`
Expected: SUCCESS — bundle builds with no errors. (This is the spec's required web gate; it also catches react-native-web incompat in the new screens.)

- [ ] **Step 4: Manual web smoke (documented, not automated here)**

With `npm run web`, verify by hand on web (use the verification harness recipe in memory `project_web_verification_harness` if automating): Study tab shows the Library summary (4 unlocked / 8 locked for a guest = free); completing the daily quiz then re-entering shows the LockNudge with honest "resets tomorrow / coming soon" copy and NO purchase button (paywall OFF); running 3 Spot Trainer sessions then a 4th shows the blocked state; reduced-motion + screen-reader pass on the new surfaces.

- [ ] **Step 5: Commit (if any doc/ledger updates were made)**

If you update `docs/release/prod-visible-changes.md` to ledger the flag flips (recommended per spec §13), commit it:
```bash
git add docs/release/prod-visible-changes.md
git commit -m "docs(release): ledger Phase 1 free-training-taste flag flips (study/content/retention ON)"
```

---

## Self-Review notes (for the executor)

- **Spec coverage:** config constants (Task 1, §6), pure dailyLimits + tests (Task 2, §4/§6/§9), store daily counter + migration (Tasks 3–4, §4/§6), QuizRunner gate + free-only content + indicator + nudge (Task 7, §6), SpotTrainer gate + indicator + nudge (Task 8, §6), lock states in LessonModules + Study home via `availabilityOf` (Tasks 9–10, §6), quiz/lesson XP wiring (Task 11, §6/§9), flags ON + CI guard (Task 12, §6/§10), a11y (Task 13, §11), gates (Task 14, §9). Honesty gate: no purchase path when `paywall` OFF (Task 6 LockNudge), `premium_study`/billing are Subsystem 3 — explicitly NOT introduced here.
- **Type consistency:** `DailyLimitKind` ('quiz' | 'trainerSession') is defined once in `config.ts`, re-exported from `dailyLimits.ts`, and used in `StudyProgress.dailyLimitCounters`, `StudyContext`, and both screens. `LimitStatus { allowed, remaining }` is the single shape returned by `limitStatus`/`limitFor`. `recordQuizCompleted`/`recordLessonCompleted` names match across `progress.ts`, `StudyContext`, and (as `applyQuizDone`/`applyLessonDone` aliases) the context import. `XP_WEIGHTS.quizCompleted`/`lessonCompleted` and `EngagementSignals.quizzesCompleted`/`lessonsCompleted` are consistent across `xp.ts`, `types.ts`, tests, and `EngagementContext`.
- **No placeholders:** every code step shows real code; every test step shows real assertions; every run step shows the exact command + expected result.
