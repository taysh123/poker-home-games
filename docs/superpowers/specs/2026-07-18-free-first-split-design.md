# Free-First Split — Design Spec

- **Date:** 2026-07-18
- **Status:** Approved by owner (decisions 1–4 below); pre-implementation
- **Supersedes:** the Paddle-gated launch sequence and the S9 "honesty flip" in
  `docs/release/RESUME-HERE.md` / `go-live-runbook.md`. Those steps must **never** be executed:
  web payments are dead (Paddle rejects poker). App-store billing comes later, behind the
  existing `IBillingVerifier` / provider seams.

---

## 1. Context & decision

T Poker ships a **free-first** version to the app stores. Everything paid is shown honestly as
**"Coming soon" and is not purchasable anywhere**. The AI Coach makes **zero API calls** in the
free build. Education (Learn / Practice) leads the product framing for App Store classification.

**Target split**

| FREE (at launch) | PAID ("Coming soon", gated OFF) |
|---|---|
| Home-game manager — buy-ins, cash-outs, blind timer, settlements (full) | Full lesson library (beyond the 3 free) |
| Groups, crew, leaderboards, stats (full) | Unlimited Practice (beyond 5/day) |
| Practice / Spot Trainer — **5 questions per day**, renewing daily | AI Coach (zero API calls in free build) |
| Lessons — **3 starter lessons** | Cloud Sync |
| Daily quiz — free daily | Advanced Bankroll Analytics |

## 2. Approved decisions

1. **Sequencing** — the frozen stack merges first (**owner's action**): #4 → #5 → #6 → #14 → #11,
   CI green at each step (watch-fors in §7). Then all free-first work lands as **one new PR,
   `feature/free-first-split`**, on top of merged main. Verified: no stack PR touches billing
   config, `PREMIUM_FEATURES`, or billing feature flags (empty diffs on
   `features/premium/config.ts` for #4/#5/#6/#14; `src/config/features.ts` changed only by #14,
   flipping the UX flags `v2Splash`/`welcome`).
2. **Practice pool** — **shared** across Spot Trainer and Decision Trainer, **5 total/day**, as the
   single tunable constant `FREE_PRACTICE_QUESTIONS_PER_DAY = 5`. Calendar-day reset at **local
   midnight** (fixes the current UTC `todayKey()` bug). Owner confirms this tightens the free tier
   from ~30 questions/day to 5 — intentional.
3. **Free lessons** — `LM-01 Preflop Opening Ranges`, `LM-05 Tournament Basics`,
   `LM-04 Bankroll & Mindset` (the three zero-prerequisite beginner modules). `LM-02 Blind
   Defense Basics` and `LM-06 Push/Fold Introduction` are the first **locked "Coming soon"** rows
   (each has exactly one free prerequisite → visible progression).
4. **Premium teaser** — one Profile row → the existing PaywallScreen **honest preview** (its
   `paywall`-flag-OFF branch: feature list with "Soon" chips, no plan cards, no purchase, no
   restore). Builds desire; nothing purchasable.

Plus: flip `premium_study` back to `comingSoon: true`; fix the onboarding "Your first analysis is
on us" broken promise; education-first onboarding + store copy (§5.5).

## 3. Current-state anchors (all verified on `main` @ beee003 + branch diffs)

- **Honesty switchboard:** `apps/poker-mobile/src/features/premium/config.ts` →
  `PREMIUM_FEATURES[].comingSoon`; helpers `liveFeatureKeys()` / `isFeatureLive(key)`; pinned by
  `features/premium/__tests__/honesty.test.ts` + `paywallContent.test.ts`; mirrored by
  `apps/landing/lib/features.ts` (+ its own honesty test). Today `premium_study` is the sole
  `comingSoon: false` entry — a leftover of the dead Paddle plan.
- **Kill switches:** `src/config/features.ts` — `paywall`, `coach`, `bankroll` all `false` in
  PROD **and** BETA. Every navigation entry to the Paywall route is itself `paywall`-gated.
- **Entitlements:** server-authoritative (`GET /api/entitlements` from `Subscription` rows,
  fail-closed); guests always free; cache `tpoker.entitlement.v1`.
- **Daily-limit engine:** `features/study/config.ts` (`FREE_QUIZ_PER_DAY = 1`,
  `FREE_TRAINER_SESSIONS_PER_DAY = 3`) + pure `logic/dailyLimits.ts` (date-keyed counters,
  premium ⇒ ∞) persisted in `tpoker.study.v1`. `todayKey()` in `state/StudyContext.tsx` is
  currently `toISOString().slice(0,10)` — **UTC**, not local.
- **Trainer:** 10-question Spot runs (`QUIZ_LENGTH = 10`, session consumed at mount), endless
  Decision mode; 845-spot bundled starter dataset; fully offline, guest-capable.
- **Lessons:** infra complete (`LessonModulesScreen`/`LessonReaderScreen`, `availabilityOf` lock
  UI, XP) but **zero lesson packs bundled** — prod shows "No lessons yet". The 0.8.1 export has
  28 modules: `learning_modules.pack.json` (26 KB), `lesson_content.pack.json` (112 KB),
  `learning_tracks.pack.json` (9 KB).
- **AI Coach zero-API chain (4 independent layers):** `coach` flag OFF → no UI; server provider
  default `"mock"`; null `CoachAiSettings:ApiKey` → Anthropic adapter throws fail-closed (credit
  refunded); `[Authorize]` + no anonymous AI. Model default pinned to
  `claude-haiku-4-5-20251001` (PR #17 + tests).
- **Checkout unreachability:** `paywall` OFF everywhere + PaywallScreen preview branch + empty
  billing keys (mock provider) + server-side Subscription requirement.

## 4. Non-goals

App-store billing (later, behind existing seams). Remote config / server-side study metering.
Shipping the bankroll tracker (`bankroll` stays OFF; PR #4's advanced analytics sections are not
premium-gated yet — splitting them is post-launch work). Cloud Sync going live. Localization.

## 5. Design

### 5.1 Practice metering — 5 questions/day, shared pool

- `features/study/config.ts`: add **`FREE_PRACTICE_QUESTIONS_PER_DAY = 5`** (the single tunable
  knob); `DailyLimitKind` gains `'practiceQuestion'`; `trainerSession` metering is retired (type
  key retained for stored-file compatibility; tolerant default when absent).
- **Local-midnight fix:** new pure helper `localDayKey(d: Date)` (local Y-M-D formatting) replaces
  the UTC `todayKey()` in `StudyContext`. Existing stored `dayKey`s remain valid; worst case is a
  single early/late reset on the transition day. `dailyLimits.ts`'s engine is unchanged (caller
  passes the key).
- **Consumption:** one unit per **answered question**, both trainer modes, via
  `consumeLimit('practiceQuestion')` at answer time (Spot: in the answer handler; Decision: per
  rep). The mount-time `trainerSession` consume is removed. Spot runs are pre-sized to
  `min(QUIZ_LENGTH, remaining)` so no one is cut off mid-run; `remaining === 0` → LockNudge
  before start; Decision mode ends gracefully at 0 (results strip preserved).
- **Daily quiz unchanged:** `FREE_QUIZ_PER_DAY = 1` stays its own meter.
- **Degradation:** counters live on-device in `tpoker.study.v1` (guests fully supported, offline);
  corrupt file → existing quarantine → fresh counters (fails open, never bricks Practice);
  premium ⇒ ∞ via the existing bypass; device-clock tampering accepted (local-first design).
- **Storage:** additive `StudyFile` migration for the new counter key; quarantine path untouched.
- **UI:** existing chip → "N free questions left today"; LockNudge (no CTA while `paywall` OFF):
  "Daily free limit reached — resets at midnight. Unlimited practice is coming soon."

### 5.2 Lessons — bundle 3 free, library visible as Coming soon

- Bundle the full 0.8.1 `learning_modules` + `lesson_content` (+ `learning_tracks` if the UI
  needs it) into `apps/poker-mobile/assets/content/0.8.1/` and register in
  `src/content/bundledArtifacts.ts` / `bundledPacks.ts` (same flow as `quiz_sample`). Total
  ≈150 KB — no size concern. Premium lesson text ships client-gated inside the free binary —
  accepted; this is already the model for premium quiz rows.
- **Gating:** `FREE_LESSON_MODULE_IDS = ['LM-01', 'LM-05', 'LM-04']` in `features/study/config.ts`
  as an override on top of `availabilityOf`: in-list → available; every other module → locked
  row with the existing "Coming soon" presentation (gold lock / Soon chip, non-tappable, no CTA
  while `paywall` OFF). The workbook's `FreeOrPremium` column is untouched (it marks 5 free;
  config narrows to 3 — **config wins**, one tuning point).
- Catalog order unchanged, so LM-02/LM-06 appear as the first locked rows.
- Lessons remain **unmetered** (limits apply to Practice questions and quiz runs only).

### 5.3 Honesty flip-back (`premium_study` → Coming soon)

- `features/premium/config.ts`: `premium_study.comingSoon = true` → `liveFeatureKeys()` returns
  `[]`; all four premium features present as "Soon" on the preview.
- **Same commit:** update `honesty.test.ts` + `paywallContent.test.ts` (assert **zero** live
  features) and `apps/landing/lib/features.ts` (+ its honesty test) — no buy CTA anywhere.
- Verify `isFeatureLive` consumers: `cloud_sync` stays comingSoon (client sync service stays
  zero-network); implementation confirms no consumer lights up from this flip.

### 5.4 Premium teaser entry point

- `ProfileScreen`: one new row/card — "Premium · Coming soon" → `navigate('Paywall',
  { trigger: 'profile_teaser' })`. **Deliberately not gated** on the `paywall` flag (the flag
  stays OFF; the destination's flag-OFF branch *is* the honest preview). New trigger value added
  to the Paywall route types.
- Test: with `paywall` OFF, the teaser route renders the preview with zero purchase UI
  (extends the honesty guards).

### 5.5 Education-first copy

- **OnboardingV2 pillars reordered — Learn leads:**
  1. **Learn** — "Real lessons, a daily quiz, and drills that build instinct. Free every day."
  2. **Practice** — "Five free trainer questions a day. Streaks that keep you sharp."
  3. **Play** — "Run the night — buy-ins, blind clock, one-tap settlement."
  4. **Track** — "Your real numbers — sessions, ROI, win rate."
  The Improve slide's AI promise is replaced with: "AI hand coaching is coming soon — your study
  tools are ready today." (The coach router card stays flag-gated/hidden.)
- **Store listing** (`docs/store-release.md`): subtitle "Learn poker · Run game night"; short
  description "Learn real poker strategy with daily drills and lessons — and run your home game
  night: buy-ins, blind timer, instant settlements."; category stays Lifestyle/Utilities primary,
  add **Education** secondary (iOS); extend the reviewer note with the study pillar; screenshot
  order leads with Spot Trainer / Lessons / daily quiz (regenerate PNGs **after** #4 merges — it
  replaces them all as binaries).
- `WelcomeScreen` legal line (PR #14) kept verbatim. Optional stretch (not required for launch):
  a "Today's drill" chip on `HomeScreen`.

### 5.6 Ship invariants (must all hold)

1. `paywall` false in PROD + BETA; no purchase UI reachable from any screen.
2. All billing env keys empty; `BillingSettings.Provider = "mock"`; server grants premium only
   from real `Subscription` rows.
3. `coach` false; Railway has **no** `CoachAiSettings__Provider` / `__ApiKey` → zero Anthropic
   calls (all four layers intact).
4. `bankroll` false (advanced analytics stays dark).
5. Every `PREMIUM_FEATURES` entry `comingSoon: true`; the S9 honesty flip is never executed.
6. Guest mode: full free tier, no account, no writes before consent (PR #14 invariant).

## 6. Test plan

- **dailyLimits:** question-unit metering, shared pool across modes, pre-sized runs,
  local-midnight key (incl. TZ edge), stored-file migration tolerance.
- **Lessons:** exactly `FREE_LESSON_MODULE_IDS` available; others locked with Coming-soon
  presentation; bundled artifacts load on native + web backends.
- **Honesty:** updated guards assert zero live features + no purchase UI, incl. via the
  `profile_teaser` route; landing tests updated in the same commit.
- **Gates (all green before merge):** `npx tsc --noEmit` · `npx jest` (expect >620 at stack head)
  · `dotnet build` + `dotnet test` (expect 181) · expo web export · landing vitest/build ·
  gitleaks.

## 7. Sequencing

**Phase 0 — owner merges the frozen stack** (my hands off): #4 → #5 → #6 → #14 → #11, CI green
each step. Watch-fors:

| Step | Watch for |
|---|---|
| #4 (`feature/launch-buildout`) | Only expected conflicts vs main: `apps/landing/app/page.tsx` + `components/blocks/Footer.tsx` (keep main's TrustBanner/domain lines + #4's Showcase). Merge auto-deploys Railway; `Database.Migrate()` on startup applies the CloudSync migration — watch deploy logs for "Database migrations applied". #4 carries one stray docs-only commit (6e808a9) — harmless. |
| #5 (`coach-study-quality`) | Backend coach quality; no flags flipped. Touches `AnalyzeHandCommand.cs` (see #11). |
| #6 (`lottie-polish`) | Small; new lottie assets + Celebration variants. |
| #14 (`entry-experience`) | Flips `v2Splash`/`welcome` ON — intentional UX decision, keep. Owns `features.ts`/`app.json`. Jest count ≈620 here. |
| #11 (`security-hardening`) | Merges **last**; expect a hand-resolve in `AnalyzeHandCommand.cs` (#5's grounding params + #11's idempotency — keep both). **Before this deploys: confirm `ASPNETCORE_ENVIRONMENT=Production` on Railway** (enables forwarded headers; without it all users share one rate-limit bucket → login lockout). Add no proxy env var (`ForwardLimit=1` in code). dotnet tests ≈181. |

CI note: PR checks run main's `ci.yml` (added after the stack branched) against the merge ref —
each PR gets the full pipeline automatically.

**Phase 1 — `feature/free-first-split`** (one PR on merged main): §5.1–§5.5 + invariant tests.
Implementation plan via superpowers:writing-plans after owner reviews this spec.

**Phase 2 — post-launch (out of scope):** app-store billing behind existing seams; premium-gate
PR #4's advanced bankroll sections before ever flipping `bankroll` on; content growth
(`study-content-spec.md`); domain-migration one-liners from RESUME §6.

## 8. Risks & mitigations

- **5/day tightening** (~30 → 5) — intentional; single constant to retune; streak/XP loop
  unaffected.
- **Premium lesson text in the free binary** — accepted (tiny, client-gated, existing pattern).
- **Clock tampering refreshes the limit** — accepted; local-first, no server dependency.
- **Local-midnight transition** — one-time day-key mismatch at rollout; worst case one early
  reset. No migration needed.
- **Stack-merge conflicts** — enumerated in §7; only `AnalyzeHandCommand.cs` needs a real
  hand-merge.
- **Store review** — education-first framing strengthens the existing anti-gambling posture
  (`store-release.md` reviewer notes; Welcome legal line).
