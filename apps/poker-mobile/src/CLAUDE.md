# Frontend Architecture — poker-mobile/src

> Rewritten 2026-07-22 against the Phase-1 audit (the previous version described a 4-tab app with
> per-file axios instances — long gone). Keep this file PATTERNS-first: point at the load-bearing
> files instead of enumerating every screen (inventories rot; ~50 routable surfaces exist).

## Directory Map

```
src/
├── analytics/     # Vendor-neutral warehouse contract + adapter (tested; PostHog wiring in utils/analytics)
├── api/           # Typed API modules — ALL share api/apiClient.ts (see below)
├── components/    # Shared UI (~50): Velvet Table set, motion/ (Reanimated 4), brand/ (splash), table/ (felt kit)
├── config/        # features.ts — the compile-time flag switchboard (see below)
├── content/       # ContentStore: bundled pack ingest/validate/quarantine (sqlite native, memory web)
├── context/       # Core contexts (Auth, ActiveSession, LocalGames, Currency, Entitlements, Content)
├── features/      # Feature verticals, each with logic/ (pure, tested) + state/ + ui/ + data/
│   ├── bankroll/  premium/  study/  coach/  engagement/  mastery/  landing/  solver/  auth/
├── hooks/         # useGoogleAuth, useAppleAuth, useReminderScheduler, usePushNotifications, ...
├── local/         # Guest game engine: schema v4, settlements port, tournament engine, cloud-sync client
├── navigation/    # AppNavigator (two trees) + entryRouting.ts (pure, pinned)
├── screens/       # Classic screens (SessionScreen 3k lines — the critical path; Home, Groups, ...)
├── theme/         # 10 token files: colors, typography, fonts, spacing, radii, shadows, blur, iconSize, zIndex, motion
└── utils/         # Pure helpers: money, confirm/toast (web-safe), storage, analytics, reminders, localDay ban
```

## The rules that bite (read these before coding)

1. **Flags:** `config/features.ts` is the single compile-time switchboard (PROD/BETA/DEV
   resolution). PROD-ON today: study, content, retention, nav5, onboardingV2, immersive,
   v2Splash, welcome, analytics, reminders. `features.test.ts` asserts the EXACT prod matrix —
   any flag flip must extend `expectedOn` in the same PR.
2. **StudyContext writes are updater-based composed operations.** Never chain raw writes from one
   handler; never re-introduce `consumeLimit`-style primitives (this bug class shipped twice —
   see `state/__tests__/StudyContext.compose.test.tsx`).
3. **Day keys are LOCAL** (`features/study/logic/localDay.ts`). `toISOString().slice(0, 10)` is
   banned repo-wide by `utils/__tests__/dayKeyBan.test.ts`.
4. **Analytics:** `utils/analytics.ts` — typed events; dispatch is consent-gated PostHog EU
   (flag + Welcome-choice consent + opt-out + build key; pinned by `analyticsDispatch.test.ts`).
   Upgrade-trigger ids are TYPED (`features/premium/triggers.ts`) — no ad-hoc strings.
5. **Web-safety:** `Alert.alert` is a no-op on web — use `utils/confirm.ts` / `utils/toast.ts`.
   `Share.share` needs a clipboard fallback. Storage via `utils/storage.ts` only.
6. **Honesty guards:** `features/premium/config.ts` (all `comingSoon: true`) + `paywall` flag OFF
   are CI-pinned. Nothing purchasable; LockNudge is the one lock/limit surface.
7. **Money is integer cents** in `local/` (`utils/money.ts`); the settlement engine is a pinned
   TS port of the C# service — change both together (`local/__tests__/settlements.test.ts`).

## api/ — ONE shared client

All API modules import `api/apiClient.ts`: a single axios instance whose 401 interceptor
refreshes the token behind a mutex and retries; refresh failure → `onUnauthenticated` → logout.
Exception: `deviceTokensApi.ts` (own instance; push tokens bypass refresh). Token plumbing is
manual: functions take an explicit `token` argument; screens read it from `utils/storage.ts`
before each call (no request interceptor). `config.ts` exports `API_BASE_URL`.

## Navigation — two trees, one route name

`navigation/AppNavigator.tsx` branches on `user === null`:
- **Guest tree**: Welcome chooser → (first run) OnboardingV2 → `GuestTabNavigator`; local-game
  screens; Login/Register as dismissible modals; invite deep links stash via
  `utils/pendingInvite.ts` and resume after auth.
- **Authed tree**: `TabNavigator` + all server screens + the same local-game screens.

Both trees register the route name `MainTabs`; React Navigation swaps trees on auth change.
Prod IA is the flag-gated 5-tab layout (`nav5`): Home / Track / Study / Groups (+Coach when its
flag is on). ~20 shared deep screens are registered in BOTH trees — adding one means editing
both blocks (known debt). Entry routing decisions are pure in `navigation/entryRouting.ts`
(Jest-pinned). Deep links: `/join/group/:token`, `/join/session/:token` (+ `tpoker://`).

## State — 13 contexts, no global store

Providers nest in App.tsx: SafeArea → Currency → Auth → Premium → Entitlements → Content →
ActiveSession → LocalGames → Bankroll → Study → Mastery → Coach → Engagement (+ SplashGate).
Notable: ActiveSession polls `/api/auth/stats` every 30s and drives LiveGameBar (unions server
active session with the local active game); EngagementContext derives XP/rank from the other
pillars' signals — XP is MONOTONIC (rides cumulative `studyDays`, never the volatile streak);
Entitlements is server-authoritative, fail-closed, cached at `tpoker.entitlement.v1`.
Guests get the full tree — every feature context works signed-out.

## Study & content (prod-ON)

- ContentStore ingests the bundled packs at startup (`content/bundledPacks.ts` — the FULL
  1,460-question free bank; `calibration_report` is pushed FIRST, exactly once, as the shared FK
  leaf; `quiz_sample` was removed and must never return — both map to table `quiz_bank`).
- Daily quiz: filters via `selectQuestions`, then `logic/quizRotation.ts#dailyRotation` — one
  stable seeded shuffle + a daily-advancing window (fresh daily, stable within a day, no repeats
  until the pool cycles). Metering: `FREE_QUIZ_PER_DAY = 1`, shared practice pool
  `FREE_PRACTICE_QUESTIONS_PER_DAY = 10` (`features/study/config.ts`).
- Streaks live in StudyContext (freeze tokens, weekly refill, auto-freeze — `retention` flag).
  Reminders: two kinds only (`daily_study`, `streak_risk`), honesty-pinned; OS permission asked
  once, after the first completed drill.

## screens/ — where the risk is

`SessionScreen.tsx` (~3.1k lines) is the money-critical live-session monolith and duplicates
"The Final Count" with `LocalSessionScreen`/`LocalSessionSummaryScreen` (sync-by-convention —
extraction is master-plan slice 2.1; don't build new end-game features on top before it).
Screen-level tests exist only for Landing/Login/Welcome (+ context/composition tests) — logic
lives in `features/*/logic` and `local/` precisely so it's testable without screens.

## Adding a screen

1. Route name + params in `RootStackParamList` (AppNavigator).
2. `<Stack.Screen>` in the correct tree — BOTH trees if guests can reach it.
3. Screen wraps in `components/Screen`; tokens only (no hex, no raw font sizes); web-safe
   dialogs; a11y labels on touchables.
4. Typed analytics events; typed trigger ids for any premium-adjacent surface.
