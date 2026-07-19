# Free-First Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the free/paid split for the free-first store launch: 5 practice questions/day (shared pool, local-midnight reset), 3 free lessons bundled, honesty flip-back (zero live premium features), a Profile "Coming soon" premium teaser, and education-first onboarding/store copy.

**Architecture:** All gating rides existing machinery — `FREE_DAILY_LIMITS` + `dailyLimits.ts` (pure date-keyed counters in `tpoker.study.v1`), `PREMIUM_FEATURES[].comingSoon` honesty flags (CI-pinned), and the `paywall`-flag-OFF PaywallScreen preview. New surface area is limited to: one config constant per tunable, one pure `localDayKey` helper, two bundled content artifacts, and one Profile row.

**Tech Stack:** Expo SDK 54 / React Native 0.81 / TypeScript / jest (jest-expo); Next.js + vitest (landing); no backend changes.

**Spec:** `docs/superpowers/specs/2026-07-18-free-first-split-design.md` (approved 2026-07-18). Base: merged main `14b7ba9`.

## Global Constraints

- Nothing purchasable anywhere: `paywall` flag stays `false` in PROD_FLAGS and BETA_FLAGS; no purchase UI added.
- AI Coach zero-API: `coach` flag stays `false`; no coach files touched; no Railway env changes.
- `bankroll` flag stays `false`.
- Every `PREMIUM_FEATURES` entry ends `comingSoon: true`; honesty tests (mobile ×2, landing ×1) updated in the SAME commit as the config flip.
- Single tunable knobs, exact names: `FREE_PRACTICE_QUESTIONS_PER_DAY = 5`, `FREE_LESSON_MODULE_IDS = ['LM-01', 'LM-05', 'LM-04']` — both in `apps/poker-mobile/src/features/study/config.ts`.
- Copy verbatim from spec §5.1/§5.5 (quoted in tasks below).
- Gates before PR: `npx tsc --noEmit` · `npx jest` · `dotnet test PokerApp.sln` (expect 215, backend untouched) · landing `npm test`.
- Commit per task; branch `feature/free-first-split`; open PR, do NOT merge.

---

### Task 1: Practice metering — question unit + config knobs

**Files:**
- Modify: `apps/poker-mobile/src/features/study/config.ts`
- Modify: `apps/poker-mobile/src/features/study/logic/dailyLimits.ts`
- Modify: `apps/poker-mobile/src/features/study/logic/progress.ts:191-194` (`dailyCountersOf`)
- Test: `apps/poker-mobile/src/features/study/logic/__tests__/dailyLimits.test.ts` (extend)

**Interfaces:**
- Produces: `FREE_PRACTICE_QUESTIONS_PER_DAY: number`, `FREE_LESSON_MODULE_IDS: string[]`, `DailyLimitKind` now includes `'practiceQuestion'`, `practiceRunCap(remaining: number, quizLength: number): number`. Tasks 3 and 5 consume these exact names.

- [ ] **Step 1: Write failing tests** — append to `dailyLimits.test.ts`:

```typescript
describe('practiceQuestion metering (free-first)', () => {
  it('allows exactly FREE_PRACTICE_QUESTIONS_PER_DAY (5) per day, then blocks', () => {
    let c = emptyDailyCounters();
    for (let i = 0; i < 5; i++) {
      expect(limitStatus(c, 'practiceQuestion', '2026-07-19', false).allowed).toBe(true);
      c = consumeToday(c, 'practiceQuestion', '2026-07-19');
    }
    const s = limitStatus(c, 'practiceQuestion', '2026-07-19', false);
    expect(s.allowed).toBe(false);
    expect(s.remaining).toBe(0);
  });

  it('resets on a new day key', () => {
    let c = emptyDailyCounters();
    for (let i = 0; i < 5; i++) c = consumeToday(c, 'practiceQuestion', '2026-07-19');
    expect(limitStatus(c, 'practiceQuestion', '2026-07-20', false).remaining).toBe(5);
  });

  it('premium bypasses to Infinity', () => {
    expect(limitStatus(emptyDailyCounters(), 'practiceQuestion', '2026-07-19', true).remaining).toBe(Infinity);
  });

  it('tolerates stored v2 counters missing the practiceQuestion key', () => {
    const legacy = { quiz: { dayKey: '', count: 0 }, trainerSession: { dayKey: '', count: 0 } } as never;
    expect(limitStatus(legacy, 'practiceQuestion', '2026-07-19', false).remaining).toBe(5);
    const after = consumeToday(legacy, 'practiceQuestion', '2026-07-19');
    expect(after.practiceQuestion.count).toBe(1);
  });
});

describe('practiceRunCap', () => {
  it('caps a quiz run at the remaining allowance', () => {
    expect(practiceRunCap(3, 10)).toBe(3);
    expect(practiceRunCap(12, 10)).toBe(10);
    expect(practiceRunCap(Infinity, 10)).toBe(10);
    expect(practiceRunCap(0, 10)).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npx jest dailyLimits -t practiceQuestion` → FAIL (unknown kind / missing export).

- [ ] **Step 3: Implement.** `config.ts` — replace the two-knob block with:

```typescript
/** Free practice questions (Spot + Decision trainer, SHARED pool) per local day. THE tunable knob. */
export const FREE_PRACTICE_QUESTIONS_PER_DAY = 5;

/** Free multiple-choice quizzes a non-premium user may complete per local day. */
export const FREE_QUIZ_PER_DAY = 1;

/** Retired: sessions are no longer metered (questions are). Key retained for stored-file compat. */
export const FREE_TRAINER_SESSIONS_PER_DAY = 3;

/** Counter kinds tracked for daily limits. Keep in sync with StudyProgress.dailyLimitCounters. */
export type DailyLimitKind = 'quiz' | 'trainerSession' | 'practiceQuestion';

export const FREE_DAILY_LIMITS: Record<DailyLimitKind, number> = {
  quiz: FREE_QUIZ_PER_DAY,
  trainerSession: FREE_TRAINER_SESSIONS_PER_DAY,
  practiceQuestion: FREE_PRACTICE_QUESTIONS_PER_DAY,
};

/**
 * Free-first launch: the 3 starter lessons open to everyone (zero-prerequisite beginner set —
 * cash / tournament / mindset). Every other module renders locked ("Coming soon" while the
 * paywall flag is OFF). Config wins over the workbook's FreeOrPremium column.
 */
export const FREE_LESSON_MODULE_IDS = ['LM-01', 'LM-05', 'LM-04'];
```

`dailyLimits.ts` — `emptyDailyCounters` adds the key; `countToday` tolerates missing; add `practiceRunCap`:

```typescript
export function emptyDailyCounters(): DailyLimitCounters {
  return {
    quiz: { dayKey: '', count: 0 },
    trainerSession: { dayKey: '', count: 0 },
    practiceQuestion: { dayKey: '', count: 0 },
  };
}

function countToday(counters: DailyLimitCounters, kind: DailyLimitKind, todayKey: string): number {
  const c = counters[kind];               // may be absent in files stored before practiceQuestion existed
  return c && c.dayKey === todayKey ? c.count : 0;
}

// consumeToday: same tolerance —
export function consumeToday(counters: DailyLimitCounters, kind: DailyLimitKind, todayKey: string): DailyLimitCounters {
  const prev = counters[kind];
  const isToday = !!prev && prev.dayKey === todayKey;
  return { ...counters, [kind]: { dayKey: todayKey, count: (isToday ? prev.count : 0) + 1 } };
}

/** Size a quiz run so it never outruns today's allowance (∞ ⇒ full length). Pure. */
export function practiceRunCap(remaining: number, quizLength: number): number {
  return remaining === Infinity ? quizLength : Math.max(0, Math.min(quizLength, remaining));
}
```

`progress.ts` — per-key tolerant read:

```typescript
export function dailyCountersOf(p: StudyProgress): DailyLimitCounters {
  return { ...emptyDailyCounters(), ...(p.dailyLimitCounters ?? {}) };
}
```

- [ ] **Step 4: Run** `npx jest dailyLimits` → all PASS. **Step 5: Commit** `feat(study): question-unit practice metering — FREE_PRACTICE_QUESTIONS_PER_DAY=5 + FREE_LESSON_MODULE_IDS`.

### Task 2: localDayKey — local-midnight reset

**Files:**
- Create: `apps/poker-mobile/src/features/study/logic/localDay.ts`
- Test: `apps/poker-mobile/src/features/study/logic/__tests__/localDay.test.ts`
- Modify: `apps/poker-mobile/src/features/study/state/StudyContext.tsx:57` (replace UTC `todayKey`)

**Interfaces:** Produces `localDayKey(d?: Date): string` ('YYYY-MM-DD' from LOCAL components).

- [ ] **Step 1: Test:**

```typescript
import { localDayKey } from '../localDay';

describe('localDayKey', () => {
  it('formats from LOCAL date components with zero-padding', () => {
    expect(localDayKey(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');   // just past local midnight
    expect(localDayKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31'); // just before local midnight
  });
  it('defaults to now and returns a well-formed key', () => {
    expect(localDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: FAIL** (module missing). **Step 3: Implement:**

```typescript
/**
 * Local calendar-day key ('YYYY-MM-DD') from LOCAL date components — daily limits reset at the
 * user's local midnight. (The previous toISOString() key was UTC: in UTC+3 the "day" flipped at
 * 03:00 local.) Device-clock tampering is accepted — local-first design, no server dependency.
 */
export function localDayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
```

- [ ] **Step 4:** In `StudyContext.tsx` delete `const todayKey = () => new Date().toISOString().slice(0, 10);`, add `import { localDayKey } from '../logic/localDay';`, and replace all 6 `todayKey()` call sites with `localDayKey()`. **Step 5:** `npx jest localDay studyContext` PASS → commit `fix(study): daily limits reset at LOCAL midnight (localDayKey replaces UTC key)`.

### Task 3: SpotTrainerScreen — consume per question, pre-sized runs

**Files:**
- Modify: `apps/poker-mobile/src/features/study/ui/SpotTrainerScreen.tsx`

**Interfaces:** Consumes `limitFor('practiceQuestion')`, `consumeLimit('practiceQuestion')`, `practiceRunCap`.

- [ ] **Step 1: Edit the screen** (mechanical; logic pinned by Task 1 tests):
  1. `const qLimit = limitFor('practiceQuestion');` replaces `sessionLimit`; `const [blocked] = useState(!qLimit.allowed);`
  2. `const [runCap] = useState(() => practiceRunCap(qLimit.remaining, QUIZ_LENGTH));` — import `practiceRunCap` from `../logic/dailyLimits`.
  3. Mount effect: DELETE `void consumeLimit('trainerSession');` (keep the `track(...)`).
  4. `choose()`: after `setResult`/counts add `await consumeLimit('practiceQuestion');` (before `recordAnswer`).
  5. Quiz sizing: every `QUIZ_LENGTH` in render/`next()` → `runCap` (header subtitle, ProgressBar value + label, `next()`'s `answered >= runCap`, footer `'See results'` condition).
  6. Decision mode exhaustion: in `next()`, before generating a new spot: `if (!isQuiz && !limitFor('practiceQuestion').allowed) { finishSession(); return; }`
  7. Chip: `label={qLimit.remaining === Infinity ? 'Unlimited questions' : `${qLimit.remaining} free question${qLimit.remaining === 1 ? '' : 's'} left today`}` (+ matching `accessibilityLabel`).
  8. LockNudge copy: `comingSoonBody="Daily free limit reached — resets at midnight. Unlimited practice is coming soon."` / `upgradeBody="You've used today's free practice questions. Go unlimited with Premium."` (trigger stays `trainer_daily_limit`).

- [ ] **Step 2:** `npx tsc --noEmit` clean; `npx jest` all green. **Step 3: Commit** `feat(study): practice meters per question — shared 5/day pool, runs pre-sized to remaining`.

### Task 4: Honesty flip-back — zero live premium features (one commit, both apps)

**Files:**
- Modify: `apps/poker-mobile/src/features/premium/config.ts:87` (`premium_study` → `comingSoon: true`; update the §HONESTY comment: "Free-first launch (2026-07-19): NOTHING is live/chargeable — all four benefits are Coming soon; app-store billing later.")
- Modify: `apps/poker-mobile/src/features/premium/__tests__/honesty.test.ts` — replace first two tests with:

```typescript
it('free-first launch: ZERO live features — every premium benefit is comingSoon:true', () => {
  expect(PREMIUM_FEATURES.filter(f => f.comingSoon === false)).toHaveLength(0);
  expect(PREMIUM_FEATURES.length).toBeGreaterThanOrEqual(4);
  expect(PREMIUM_FEATURES.every(f => f.comingSoon === true)).toBe(true);
});
```
  (keep the verbatim `premium_study.desc` copy pin test unchanged).
- Modify: `apps/poker-mobile/src/features/premium/__tests__/paywallContent.test.ts` — first test becomes `expect(liveFeatureKeys()).toEqual([]);` + `expect(isFeatureLive('premium_study')).toBe(false);`; second test unchanged (vacuously stronger).
- Modify: `apps/landing/lib/features.ts` — `premium_study`: `live: false`, DELETE the `buyHref` line; header comment → "Free-first launch: NOTHING is purchasable — all benefits coming soon."
- Modify: `apps/landing/__tests__/honesty.test.ts` — first two tests become: zero live (`expect(PREMIUM_FEATURES.filter(f => f.live)).toHaveLength(0)`; `expect(liveFeatures()).toEqual([])`) and "NO feature exposes a buyHref" (loop ALL features asserting `f.live === false && f.buyHref === undefined`). Keep the store-badge test.

- [ ] **Steps:** flip config first, run `npx jest honesty paywallContent` → old pins FAIL (proves the guards work) → update the 3 test files → mobile jest + `cd apps/landing; npm test` PASS → single commit `feat(premium)!: honesty flip-back — zero live features for free-first launch (web billing dead)`.

### Task 5: Lessons — bundle 3-free library

**Files:**
- Create: `apps/poker-mobile/assets/content/0.8.1/learning_modules.pack.json` + `lesson_content.pack.json` (copy from `content/release-0.8.1/exports/0.8.1/packs/`, byte-identical)
- Modify: `apps/poker-mobile/src/content/bundledArtifacts.ts` (+2 functions, same pattern), `apps/poker-mobile/src/content/bundledPacks.ts` (push pair, both-or-neither try/catch like the catalog pair)
- Modify: `apps/poker-mobile/src/features/study/logic/lessons.ts` — add pure gate; `apps/poker-mobile/src/features/study/ui/LessonModulesScreen.tsx` — use it
- Test: `apps/poker-mobile/src/features/study/logic/__tests__/lessons.test.ts` (extend or create)

**Interfaces:** Produces `lessonAvailability(moduleId: string, isPremium: boolean): 'available' | 'locked'`.

- [ ] **Step 1: Test:**

```typescript
import { lessonAvailability } from '../lessons';

describe('lessonAvailability (free-first: FREE_LESSON_MODULE_IDS wins)', () => {
  it('opens exactly LM-01 / LM-05 / LM-04 for free users', () => {
    for (const id of ['LM-01', 'LM-05', 'LM-04']) expect(lessonAvailability(id, false)).toBe('available');
  });
  it('locks everything else for free users (incl. workbook-Free LM-02/LM-06)', () => {
    for (const id of ['LM-02', 'LM-06', 'LM-03', 'LM-15', '']) expect(lessonAvailability(id, false)).toBe('locked');
  });
  it('premium opens all', () => {
    expect(lessonAvailability('LM-15', true)).toBe('available');
  });
});
```

- [ ] **Step 2: FAIL. Step 3: Implement** in `lessons.ts`:

```typescript
import { FREE_LESSON_MODULE_IDS } from '../config';

/**
 * Free-first gate: config's FREE_LESSON_MODULE_IDS is the single source of which lessons are open —
 * it OVERRIDES the workbook's FreeOrPremium column (which marks 5 free; launch opens 3). Premium
 * (future) opens everything. Fail-closed: unknown/empty id ⇒ locked.
 */
export function lessonAvailability(moduleId: string, isPremium: boolean): 'available' | 'locked' {
  if (isPremium) return 'available';
  return FREE_LESSON_MODULE_IDS.includes(moduleId) ? 'available' : 'locked';
}
```

  In `LessonModulesScreen.tsx`: replace `availabilityForModule` body with `return lessonAvailability(moduleId, isPremium);` (import from `../logic/lessons`; drop the now-unused pack-join pieces: `packs`/`modulePackIds` state, `buildPackCatalog`/`availabilityOf`/`packById` imports, and the two extra `query.all` calls — keep `query.all('learning_modules')` only). Locked rows keep the existing gold-lock non-tappable presentation (`paywall` OFF).
  In `bundledArtifacts.ts` add:

```typescript
/** Learning modules ContentPack (lesson catalog — 28 modules). */
export function learningModulesPackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/learning_modules.pack.json');
}

/** Lesson content ContentPack (section text; FK → learning_modules). Bundled WITH learning_modules. */
export function lessonContentPackArtifact(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../assets/content/0.8.1/lesson_content.pack.json');
}
```

  In `bundledPacks.ts` push the pair (both-or-neither):

```typescript
  // Lesson pair — modules + their content sections ingest together (FK lesson_content → learning_modules).
  try {
    const modules = learningModulesPackArtifact() as ContentPack;
    const lessons = lessonContentPackArtifact() as ContentPack;
    packs.push(modules, lessons);
  } catch {
    /* lesson packs not bundled → Lessons shows the honest empty state */
  }
```

- [ ] **Step 4:** If `src/content/__tests__/bundledArtifacts.test.ts` enumerates artifacts, add the two new ones to its drift guard. `npx jest lessons bundled` + `npx tsc --noEmit` PASS. **Step 5: Commit** `feat(study): bundle lesson library — 3 starter lessons free (LM-01/LM-05/LM-04), rest locked Coming-soon`.

### Task 6: Profile premium teaser

**Files:**
- Modify: `apps/poker-mobile/src/screens/ProfileScreen.tsx` (after the CloudSyncCard block at ~line 417-420)

- [ ] **Step 1:** Insert (NOT gated on the `paywall` flag — destination's flag-OFF branch is the honest preview, pinned by honesty tests):

```tsx
        {/* ── Premium teaser (free-first): honest Coming-soon preview — nothing purchasable ── */}
        <MotiView {...slideUpSequence({ reduced, delay: staggerIn(4) })}>
          <PressableScale
            style={styles.aboutRow}
            onPress={() => navigation.navigate('Paywall', { trigger: 'profile_teaser' })}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel="Premium, coming soon — see what's planned"
          >
            <Ionicons name="sparkles-outline" size={18} color={colors.gold} />
            <Text style={styles.aboutRowText}>Premium</Text>
            <Chip label="Coming soon" tone="gold" />
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </PressableScale>
        </MotiView>
```

  (Match the file's actual `aboutRow`/`aboutRowText` style names + `Chip` import when editing; reuse whatever row idiom directly surrounds it.)
- [ ] **Step 2:** `npx tsc --noEmit` + `npx jest` green. **Step 3: Commit** `feat(premium): Profile "Premium — Coming soon" teaser → honest paywall preview (nothing purchasable)`.

### Task 7: Education-first onboarding pillars

**Files:**
- Modify: `apps/poker-mobile/src/screens/OnboardingV2Screen.tsx:34-39` (PILLARS) + the `improve` router-card sub-copy

- [ ] **Step 1:** Replace PILLARS with (spec §5.5 verbatim):

```typescript
/** The four pillars — education-first onboarding (Learn → Practice → Play → Track). */
const PILLARS: { icon: IoniconsName; title: string; subtitle: string }[] = [
  { icon: 'school',      title: 'Learn',    subtitle: 'Real lessons, a daily quiz, and drills that build instinct. Free every day.' },
  { icon: 'fitness',     title: 'Practice', subtitle: 'Five free trainer questions a day. Streaks that keep you sharp.' },
  { icon: 'play-circle', title: 'Play',     subtitle: 'Run the night — buy-ins, blind clock, one-tap settlement.' },
  { icon: 'wallet',      title: 'Track',    subtitle: 'Your real numbers — sessions, ROI, win rate.' },
];
```

  The old Improve slide's AI promise ("Your first analysis is on us") is gone with the slide; the coach ROUTER card (already `coach`-flag-gated, hidden in prod) gets sub-copy `'AI hand coaching — coming soon'` replacing `'Free with an account'`. If a jest snapshot/test pins the old pillar copy, update it to the new strings.
- [ ] **Step 2:** `npx tsc --noEmit` + `npx jest` green. **Step 3: Commit** `feat(onboarding): education-first pillars — Learn leads; AI promise removed (coming soon)`.

### Task 8: Store listing copy (docs only)

**Files:**
- Modify: `docs/store-release.md` (listing-copy + category + reviewer-note sections)

- [ ] **Step 1:** Apply spec §5.5: subtitle **"Learn poker · Run game night"**; short description **"Learn real poker strategy with daily drills and lessons — and run your home game night: buy-ins, blind timer, instant settlements."**; keep category Lifestyle/Utilities primary, ADD "Secondary category (iOS): Education"; extend the reviewer note's first sentence to "T Poker is a poker STUDY app with a scorekeeping tool for private home games." (rest unchanged); add a screenshot-order note: lead with Spot Trainer → Lessons → daily quiz shots before the game-night set. **Step 2: Commit** `docs(store): education-first listing copy — Learn leads, Education secondary category`.

### Task 9: Full gates + PR

- [ ] `cd apps/poker-mobile; npx tsc --noEmit` → clean. `npx jest --ci` → all suites green (659 baseline + new).
- [ ] `cd apps/landing; npm test` → green (honesty pins updated). `npm run typecheck` → clean.
- [ ] Repo root: `dotnet test PokerApp.sln` → 215/215 (backend untouched — sanity only).
- [ ] Push `feature/free-first-split`; `gh pr create` (base main) titled "Free-first split: 5/day practice, 3 free lessons, zero live premium, education-first copy"; body = summary + spec/plan links + §5.6 invariant checklist. Do NOT merge.

## Self-Review (done)

- **Spec coverage:** §5.1→Tasks 1-3; §5.2→Task 5; §5.3→Task 4; §5.4→Task 6; §5.5→Tasks 7-8; §5.6 invariants→Global Constraints + Task 9 checklist; §6 test plan→Tasks 1,2,4,5. Deviation (documented): no dedicated teaser render-test — the teaser's safety property lives in PaywallScreen's flag-OFF branch, already pinned by the honesty guards; a ProfileScreen render test would drag the full auth/context tree for no new assertion.
- **Placeholders:** none.
- **Type consistency:** `practiceQuestion` / `practiceRunCap` / `FREE_LESSON_MODULE_IDS` / `lessonAvailability` names match across Tasks 1/3/5.
