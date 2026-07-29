# Q1.4b — Review prompts: the firing path

- **Date:** 2026-07-29 · **Status:** NOT STARTED. Needs its own design pass before any code.
- **Why this exists:** Q1.4 shipped the reviewed *core* (pure eligibility rules, store, native
  wrapper, `isCelebrating`, `SUPPORT_EMAIL`) with the `reviews` flag **OFF** and **no firing path**.
  Three adversarial critic-fleet rounds found the same defect class in three successive firing
  designs: **the rating dialog fires when it must not.** Rather than patch a fourth instance at the
  end of a long session, the owner split the slice.
- **What Q1.4b owns:** deciding *when* to ask, wiring the moments, and flipping the flag.

## 1. The pattern to design against

Every round, the *pure* layer was correct — eligibility, dedupe, closure discipline, and geometry
arithmetic all passed scrutiny each time. Every failure was in **integration with app lifecycle,
navigation, and concurrent tasks**. Q1.4b should therefore treat "when may we ask?" as the hard
problem and design it explicitly, rather than treating it as plumbing around a solved rule set.

## 2. Carried-forward findings — all confirmed, none fixed

### 2.1 Blockers

| # | Finding | Fix shape |
|---|---|---|
| B1 | **A pending request never expires.** The dwell is a minimum, never a maximum. `too_new → eligible` is a pure wall-clock transition needing no user action, so a request armed on Tuesday fired **mid-game on Thursday** when the 3-day install floor elapsed — and that floor lands at the same time of day the user installed, statistically game night. | A request is valid only within `[armedAt + dwell, armedAt + dwell + grace]`. Outside it, drop. |
| B2 | **React hooks below a conditional return** in `LocalSessionSummaryScreen` (`if (!game) return` guard, hooks appended after it). Crashes with "Rendered fewer hooks than expected" when a game is deleted on a still-mounted screen. Invisible to `tsc` and `jest`; **no ESLint config exists in `apps/poker-mobile`**. | Hooks above every guard, always. See §4. |

### 2.2 Majors

- **No location awareness at fire time.** Reachable in 1–2 taps: dialog over a **live game** (finish a drill, tap LiveGameBar), over a **live drill** ("Train again" resets the trainer in place within the 3s dwell), and over the **sign-up form** (the summary's "sign in to save results" CTA). Gate on no-Active-game — `ActiveSessionProvider` and `LocalGamesProvider` both already wrap the host.
- **`streak_milestone` has no terminal screen.** `StudyScreen` is a tab screen that stays mounted under the pushed trainer, and `progress.currentStreak` recomputes on **every answered spot** — so crossing day 7 mid-drill fires the dialog on top of the trainer 2s later. Either drop the kind or give it a genuinely terminal trigger.
- **The moments are farmable, which undercuts the whole premise.** `drill_strong` has no minimum length: in Decision mode the Finish button appears at `answered > 0`, so **one correct answer = 100% = a qualifying moment**, and the 10/day pool yields ~10 moments in minutes. The justification for dropping the sentiment sheet was "the qualifying moments ARE the sentiment filter" — that claim needs to be *made true*, not patched with a `>= 5` constant. **This is the item most needing fresh design thinking.**
- **The allowance is burned when the OS was never asked.** `requestNativeReview()` returns `false` when the module is missing, `isAvailableAsync()` is false, or the call threw — and `isAvailableAsync()` is **always false on TestFlight**. Persisting `lastPromptedAt`/`promptedVersions` before the result makes the feature unverifiable in TestFlight and self-sabotaging (a version bump per test run). Persist only on `requested === true`; keep the per-session guard unconditional.
- **Wall-clock dwell with no `AppState` gate.** Background 2s after a moment, return 30 minutes later, and the ask fires ~500ms after foregrounding — precisely the scene-activation window where iOS renders nothing, burning the allowance per the item above. Clear pending on background.
- **The host is untested.** Every blocker in every round lived in the orchestration file. A drafted provider-level suite (fake timers; 12 cases covering dwell, celebration, moment count, install floor, once-per-version, once-per-session, kill switch, dedupe, preload flush, streak-once, analytics honesty) is preserved in the Q1.4 PR discussion — start from it, and add B1/B2 regression cases.

### 2.3 Minors

- `recordStreakMilestone` silently drops before the store loads (`recordMoment` queues; this one doesn't). Works today only through accidental `useCallback` dep coupling.
- The preload flush is one-shot; a moment recorded in the few-ms window between the flush and React's commit is stranded permanently.
- The 2Hz interval is never torn down after a successful ask (waste, not incorrectness).
- `countedKeys` is bounded only at save, so memory and disk diverge past 50 keys.
- `isValid` in the store is all-or-nothing: any future field addition invalidates every stored payload and **resets `promptedVersions` + the cooldown**, re-arming the prompt for users already asked. Fail-safe for the app, fail-**open** for the rate limit. Use a defaulting merge.
- The step-3 modal in `SessionScreen` has no `onRequestClose`, so Android hardware-back can lose the server `game_summary` moment.
- `isCelebrating` covers only Engagement-owned celebrations; the screen-level `Celebration` components are covered *only* by the hardcoded dwell constants, with nothing pinning that coupling. Shortening a dwell would put the dialog over live confetti with every test green.

## 3. What already ships and must not be re-litigated

- **No in-app sentiment sheet, ever.** Master-plan decision 4a is superseded; Guideline 1.1.7
  exposure is the reason. `CLAUDE.md` says "do not re-add a sheet" and means it.
- `requestReview` is **never** called from a button handler — app-determined moment plus a timer.
- The pure rules, their literal-value pins, the `[7, 30, 100]` streak ladder, the store, the native
  wrapper, `deriveIsCelebrating` + its truth table, and `SUPPORT_EMAIL` are all reviewed and green.

## 4. Prerequisite worth doing first

**Add ESLint with `react-hooks/rules-of-hooks` to `apps/poker-mobile`** (own small slice). There is
no ESLint config today, which is exactly why B2 — a genuine crash — passed `tsc`, 1048 jest tests,
and a web export. That is a whole bug class the repo currently cannot see, and it is not specific
to this feature.
