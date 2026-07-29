# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Product Vision

T Poker is a premium live poker home-game management platform for private friend groups. It tracks buy-ins, cash-outs, settlements, and lifetime statistics across sessions and groups.

**Core principle:** The live session screen is the critical path — it must work flawlessly, with minimal taps and no blocking UI. Everything else is secondary.

**Launch status (2026-07-19):** shipping **free-first** to the app stores. Web payments are dead (Paddle rejects poker); app-store billing comes later behind the existing `IBillingVerifier` seam. All frozen launch PRs (#4→#5→#6→#14→#11) and the free-first split (#20) are merged to `main`. Free = home-game manager + groups/stats + daily quiz + 3 starter lessons + **10 shared practice questions/day** (`FREE_PRACTICE_QUESTIONS_PER_DAY` in `apps/poker-mobile/src/features/study/config.ts`; both trainers share one pool via `recordPracticeAnswer`). Premium (full lessons, unlimited practice, AI Coach, Cloud Sync, advanced bankroll) is **"Coming soon", not purchasable** — a CI-pinned honesty config (`features/premium/config.ts`, all `comingSoon: true`) keeps zero live features; AI Coach makes **zero** API calls. Design of record: `docs/superpowers/specs/2026-07-18-free-first-split-design.md`. The Paddle-gated plan in `docs/release/RESUME-HERE.md` §1–§7 is **superseded/historical**.

**Evolution status (2026-07-22, Wave 0 of the product-evolution plan —
`docs/superpowers/specs/2026-07-22-product-evolution-master-plan.md` is the plan of record):**
billing is fail-closed in production (PR #24); the daily-quiz cap enforces and ALL StudyContext
writes are updater-based composed operations — never chain raw writes (PR #25); Sign in with
Apple ships on iOS (PR #26); the FULL 1,460-question free bank is bundled with date-seeded
daily rotation via `dailyRotation` (PR #27 — `quiz_sample` is gone; never re-add it, both map
to table `quiz_bank`); analytics is consent-gated PostHog EU behind the `analytics` flag +
Welcome-choice consent + `EXPO_PUBLIC_POSTHOG_KEY` (PR #28 — no key set ⇒ fully dark); streak
reminders are ON with the `free_ai` kind removed (PR #29); XP is MONOTONIC — the streak term
rides cumulative `studyDays`, never `currentStreak` (PR #30). Upgrade-trigger ids are typed in
`features/premium/triggers.ts` — never mint ad-hoc trigger strings.

---

## Commands

### Backend
```powershell
# Run API (from repo root or src/PokerApp.API)
cd src/PokerApp.API && dotnet run --launch-profile http
# API: http://0.0.0.0:5062   Swagger: http://localhost:5062/swagger

# Build check (from repo root)
dotnet build PokerApp.sln

# Add a migration
cd src/PokerApp.Infrastructure
dotnet ef migrations add MyMigration --startup-project ../PokerApp.API

# Apply migrations
dotnet ef database update --startup-project ../PokerApp.API
```

### Frontend
```powershell
cd apps/poker-mobile
npm run web        # Browser at http://localhost:8081
npm start          # Expo Go (scan QR code)
npm run tunnel     # ngrok for physical devices

# Type check (must pass before committing)
npx tsc --noEmit

# Unit tests (must pass before committing — settlement engine, local game store)
npx jest
```

**Mobile dev note:** When testing on a physical device, update the LAN IP in `apps/poker-mobile/src/api/config.ts`. It falls back to `localhost:5062` only on web.

---

## Architecture Overview

Monorepo: `apps/poker-mobile` (Expo SDK 54, iOS/Android/Web) + `src/` (.NET 8 backend).

### Backend — Clean Architecture + CQRS

Dependency direction — inner layers never import outer:
```
Domain  ←  Application  ←  Infrastructure
                ↑
               API
```

Every mutation is a `Command`, every read is a `Query`. Each lives in `Application/Features/<Feature>/Commands/<Name>/` with:
- `*Command.cs` — MediatR `IRequest<T>` record
- `*CommandHandler.cs` — `IRequestHandler<T>`
- `*CommandValidator.cs` — FluentValidation `AbstractValidator<T>` (commands only)

MediatR and FluentValidation scan by assembly convention — **register nothing manually**.

Controllers are thin: extract `userId` from claims → build command → `await mediator.Send()` → return status code. All business logic belongs in handlers.

Exception → HTTP mapping is in `ExceptionHandlingMiddleware`:

| Exception | HTTP |
|-----------|------|
| `NotFoundException` | 404 |
| `BadRequestException` | 400 |
| `ValidationException` | 400 + field errors |
| `ConflictException` | 409 |
| `UnauthorizedException` | 401 |
| `UnauthorizedAccessException` | 403 |

**Middleware order in `Program.cs` matters:** `UseCors` must be before the exception middleware so CORS headers appear on error responses.

### Frontend — Screen-owned data fetching

Each screen owns its own state, token read, and API call. No global data store. Screens refresh on focus via `useFocusEffect`.

**Axios (converged):** all API modules in `src/api/` share `api/apiClient.ts` (one instance; 401
interceptor refreshes the token behind a mutex and retries; refresh failure → `onUnauthenticated`
→ logout). The single exception is `deviceTokensApi.ts` (own instance — push-token calls bypass
refresh). Token plumbing is still MANUAL: API functions take an explicit `token` argument and
screens read it from `utils/storage.ts` (never from context) before each call — there is no
request interceptor attaching it.

---

## Session Lifecycle

Sessions follow a strict state machine: **Draft → Active → Finished**

| State | What's allowed |
|-------|---------------|
| Draft | Add/remove players, configure chip ratio |
| Active | Buy-ins, cash-outs, hand records; no player removal (guests only) |
| Finished | Read-only; settlements can be calculated and marked paid |

Sessions can be standalone (no group) or group-scoped. `Session.GroupId` is nullable.

### Guest Players

`SessionPlayer` can represent either a registered user or a guest (non-account player):
- `UserId` set → registered user
- `GuestName` set → guest
- `LinkedUserId` (optional) → links a guest to a registered user for settlement purposes

`SessionPlayer.SettlementUserId` resolves to `LinkedUserId ?? UserId`. Guests with a `LinkedUserId` are settled as that user.

### Invite Systems

There are two separate invite mechanisms:

| Type | Entity | Lifetime | Use |
|------|--------|----------|-----|
| Group invite link | `GroupInviteLink` | Permanent, regeneratable | Anyone with the link joins the group |
| Session invite token | `SessionInviteToken` | Single-use, 24h | Joins a specific Draft/Active session |

Group invite links are generated via `POST /api/groups/{id}/invite-link`. Session tokens via `POST /api/sessions/{id}/invite`.

---

## Local (Guest) Games — `src/local/`

Guest mode runs full games on-device with zero network. Rules:

- **Amounts are ALWAYS integer cents** (`utils/money.ts`: `formatCents`, `parseAmountToCents`). Never store floats.
- `local/settlements.ts` is a TypeScript port of the backend `SettlementCalculatorService.cs` (greedy two-pointer debt minimization). **Any change to the C# algorithm must be mirrored here** — both are pinned by shared test fixtures (`local/__tests__/settlements.test.ts`).
- `local/localGamesStore.ts`: pure mutation functions (game file in → new file out) + AsyncStorage persistence under `tpoker.localGames.v1`. Corrupt payloads are **quarantined** (copied to a timestamped key), never silently cleared. Final stacks are recorded as cash-out transactions, mirroring backend `EndSessionCommandHandler`.
- `context/LocalGamesContext.tsx`: thin React wrapper; enforces at most one Active local game; serializes writes.
- `LocalGame.importedSessionId` is reserved for a future "import to cloud account" feature.
- Local games skip Draft — they're Active from creation. Status: `Active | Finished`.
- Web caveat: `Alert.alert` is a no-op on react-native-web — use `utils/confirm.ts` (`confirmDialog`/`infoDialog`) for anything that must work on web.

## Avatars & identity

Render every avatar through `src/components/Avatar.tsx` ({ name, emoji?, color?,
size, ring? }) — NEVER hand-roll initials circles. Color hash + palette live in
`src/utils/avatarColor.ts` (single source). Users pick emoji+color in
ProfileScreen; server fields `User.AvatarEmoji/AvatarColor` flow through auth,
members, leaderboard, session-player, search, and profile DTOs.

## Tournament entry points & store assets

Tournament is a FIRST-CLASS mode: dual entry cards on GuestHome, a "Host a
Tournament" CTA on authed Home, and rich mode cards in the wizard — all navigate
`LocalNewGame { mode }` (optional route param preselects the wizard). Store
listing assets (icons, feature graphic, screenshots at exact store sizes) live in
`apps/poker-mobile/store-assets/` in **study-first order** (Spot Trainer → Lessons →
daily quiz, then game-night shots). Regenerate the study screens via the Playwright
harness `store-assets/store-shots.mjs` after visual changes (see that dir's README).
Release process: docs/store-release.md.

## Local games schema v4 + tournaments

`src/local/types.ts` is at **schemaVersion 4** (v3 added `mode: 'cash' | 'tournament'` +
`tournament` config; v4 added `updatedAt` — bumped on every mutation — and `deletedAt`
tombstones for cloud sync, LIVE in prod: `deleteGame` soft-deletes and
`LocalGamesContext` filters through `liveGames()`. Chained v1→v4 auto-migration in
`loadFile`, quarantine preserved; all fields additive so older files migrate no-op).

`LocalTournamentConfig` (v3): `entryFeeCents`, `payouts: number[]` (percentages,
length = paid places — any winner count / custom distribution), editable
`blindLevels: BlindLevel[]` (SB/BB/ante/duration/break), a **stored**
`TournamentClock`, `startingStackChips?`, `rebuysAllowed`, `addOnsAllowed` +
`addOnAmountCents?`, `lateRegLevels?`, `eliminations[]`. `LocalTxn.tag?` classifies
buy-ins (`entry` | `rebuy` | `addon`).

Engine:
- `src/local/tournament.ts` — `payoutAmountsCents(pool, percents[])` (largest-
  remainder; pinned), `prizePoolCents`, `contributionCents`, `tournamentResult`,
  `eliminatePlayer` (bottom-up; position = remaining-before-bust so it stays
  correct with late registration), `undoElimination`, `finishWithRanking` (early
  finish). Payouts settle via the SAME `calculateSettlements` engine.
- `src/local/blinds.ts` — presets are GENERATORS (`generateBlindLevels`), plus a
  stored-clock model (`initClock`, `clockRemainingMs`, `pauseClock`, `resumeClock`,
  `gotoLevel`, `tickAutoAdvance`, `clockView`). The clock supports pause/resume +
  manual level jumps and survives reload (replaces the old derived-from-`createdAt`
  clock).
- Store mutations: `pauseTournamentClock`/`resumeTournamentClock`/
  `gotoTournamentLevel`/`syncTournamentClock` (auto-advance; returns same ref when
  unchanged), `finishTournamentEarly`, `isLateRegOpen`. Late entries (`addPlayer`
  while the window is open) add a tagged `entry` buy-in.

UI: the wizard (`LocalNewGameScreen`) has a payout editor (winners + editable %,
"must total 100%"), a blind-structure editor, starting stack, and rebuy/add-on/
late-reg controls. The live screen (`LocalSessionScreen`) shows a tournament
**dashboard** (level/blinds, countdown, pause/resume + ±level, players-left, avg
stack/BB-left, next-out payout); rebuy/add-on are config-gated; "End Tournament" →
Finish early (manual ranking) or Abort & delete. Tournaments do NOT use The Final
Count — they end by elimination or manual ranking.

## Notifications (in-app + push)

In-app: `Notification` entity, `INotificationService.NotifyAsync/NotifyManyAsync`
(writes rows), inbox at NotificationsScreen, fetch-on-focus. Emission points:
EndSession, InviteUserToGroup, MarkSettlementPaid (single + bulk), AchievementUnlocked.

Push (best-effort, native only — expo-notifications has NO web support):
`DeviceToken` entity ← `POST/DELETE /api/users/device-tokens`; `ExpoPushService`
posts to exp.host and deactivates `DeviceNotRegistered` tokens; it's invoked from
inside `NotificationService` after the DB write, wrapped in try/catch — push must
NEVER fail a command. Client: `src/hooks/usePushNotifications.ts` (registration in
AuthContext.saveSession, unregistration on logout, tap → Notifications screen).
Delivery testing: Android works in Expo Go; iOS needs an EAS dev build.

Local reminders (Wave 0.3 + 2.4, flag `reminders` ON, native-only): three kinds ONLY —
`daily_study` (opt-in, user-picked hour), `streak_risk` (20:00 when the streak is
alive + goal unmet), and `game_day` (2.4: a ONE-SHOT date trigger at 17:00 on the
next-game plan's gameDay; opt-out pref; cancel-on-clear falls out of the cancel-all
reschedule funnel — never schedule a notification outside `rescheduleReminders`).
Pure gating in `utils/reminderLogic.ts`; scheduling in `utils/reminders.ts` (SERIALIZED —
concurrent reschedule calls queue, latest wins; pinned by rescheduleSerialization.test.ts);
prefs at NotificationPreferencesScreen. Permission asks: the FIRST-DRILL prompt fires at
most once ever (`requestReminderPermissionOnce`, marker-pinned); the prefs screen and the
"Same crew next week?" handlers use the idempotent `ensureReminderPermission` (prompts only
while the OS still allows asking; its result drives honest toast copy — never promise a
nudge that can't fire).
HONESTY PIN: no reminder may promise an unavailable feature (the old `free_ai` kind was
removed for this) — `utils/__tests__/reminderLogic.test.ts`. Day keys are LOCAL
(`localDayKey`); `toISOString().slice(0, 10)` is banned by `dayKeyBan.test.ts`.

## Review prompts (Q1.4 — CORE ONLY, flag `reviews` OFF, nothing wired)

> **Nothing calls any of this yet.** No screen records a moment; no code path calls
> `requestReview`. Q1.4 shipped only the pieces that survived three adversarial fleet rounds.
> The firing path — when to ask, and how to guarantee the ask lands at a genuinely terminal
> moment — is **Q1.4b**, which owns the flag flip:
> `docs/superpowers/specs/2026-07-29-review-prompts-q1-4b-design.md`. That doc carries every
> confirmed finding; read it before writing a single line of firing logic. Three rounds produced
> the same defect class each time (**the dialog fires when it must not**), so the presentation
> side gets its own design pass, not a fourth patch.

### What ships today (reviewed, green, unused)

`features/reviews/` calls `expo-store-review`'s `requestReview()` **directly** after a qualifying
moment. There is deliberately **no pre-prompt of our own** — master-plan decision 4a (a sentiment
gate) was SUPERSEDED 2026-07-29: the qualifying moments already are the sentiment filter, and an
in-app gate that routes only happy users to the store is the review-gating pattern App Store
Guideline 1.1.7 names as a rejection cause. Reasoning:
`docs/superpowers/specs/2026-07-28-review-prompts-design.md` §0. **Do not re-add a sheet.**

- **All rules are pure** in `logic/reviewPromptLogic.ts` (zero imports, `nowMs` injected):
  ≥3 qualifying moments · 3-day install floor · 90-day cooldown · once per app version.
  Eligibility returns a discriminated `reason`, so tests assert *why*, not just `false`.
- **Constants are pinned to LITERAL values**, not referenced symbolically. Mutation-verified: the
  symbolic-only version stayed green with the moments gate set to 0. Rate limiting must never be
  dialable to nothing without a test going red.
- **Three moment kinds are DECLARED** — `game_summary` · `drill_strong` · `streak_milestone` — but
  none is produced yet; Q1.4b wires them and must re-earn the "producible" claim. (An earlier
  fourth kind, `achievement_dismissed`, was removed precisely because three documents claimed it
  and nothing produced it.) `streak_milestone` is a known problem: `StudyScreen` stays mounted
  under the pushed trainer and the streak recomputes per answer, so it has no terminal screen.
- **Streak milestones are a [7, 30, 100] ladder** (`crossedStreakMilestone`), never the raw streak
  value against a high-water mark — that counted every day past 7 (a 30-day streak produced 24
  moments).
- **Only the STUDY-day streak qualifies.** `HomeScreen`'s identically-named server win/loss streak
  can be NEGATIVE; asking for a rating mid-losing-streak is the failure this prevents. Pinned at
  the TYPE level via `Record<keyof ReviewSignals, true>`, so *any* added field fails `tsc`.
- **Never over a celebration:** `EngagementContext.isCelebrating`, derived by the pure
  `logic/celebration.ts#deriveIsCelebrating` so all three terms are pinned — inline, dropping
  `enabled` or `celebrate` both survived mutation testing.
- `nativeReview.ts` is native-only (lazy `require` behind a `Platform` check) and **never throws**;
  `false` is a normal outcome, not an error. iOS caps the dialog at ~3/year and returns false on
  TestFlight, so **we can never confirm a dialog appeared** — no copy may promise one, and Q1.4b
  must not consume the rate-limit allowance on a `false` result.
- `config/support.ts` is the ONE `SUPPORT_EMAIL` constant for TS call sites; `public/*.html` keeps
  its literal, pinned by `legalSurfaces.test.ts`.
- **`requestReview` must never be called from a button handler** — Apple's guidance forbids it for
  user-initiated actions, and a tap-driven call is also the review-gating shape 1.1.7 prohibits.

## Motion System — `src/components/motion/`

Reanimated 4 components layered ON TOP of the legacy `Animated` helpers in `theme/motion.ts` (both coexist; don't rewrite old screens wholesale):

| Component | Use |
|-----------|-----|
| `PressableScale` | Base touchable: spring scale + optional haptic. `PrimaryButton` uses it internally. |
| `Shimmer` | Sweeping highlight inside `SkeletonCard`/`SkeletonRow` (opacity pulse on web). |
| `AnimatedNumber` | rAF count-up for money values (Home hero, summaries). |
| `GlassView` | iOS-only blur (tab bar, ActionSheet); solid `colors.surface` on Android/web. Never inside scrolling lists. |
| `Celebration` | Confetti burst on game end; auto-unmounts; fires success haptic. |

Web rule: reanimated layout animations / `entering` props are NOT used on existing screens; basic shared-value styles are fine everywhere.

---

## Active Session Context

`ActiveSessionContext` drives the `LiveGameBar` (floats above tab bar when a game is in progress). It:
- Polls `GET /api/auth/stats` every **30 seconds**
- Refreshes on every `AppState → active` event (app foregrounded)
- Finds the first session with `status === 'Active'` from recent sessions

Call `refresh()` after starting/ending a session to update the bar immediately. Call `clear()` when navigating away from a finished session.

`LiveGameBar` itself unions two sources: the server `activeSession` (wins when both exist) and `useLocalGames().activeGame` — so the bar also appears for guests running local games. It renders inside both tab navigators.

---

## Auth

JWT: 15-min access token + 30-day refresh token (stored hashed SHA-256 in DB, never plain).

`AuthContext` lifecycle:
1. Startup: reads `user` from storage (SecureStore native, localStorage/sessionStorage web)
2. Login: calls API → `saveSession()` sets state first (drives navigation), then persists async
3. 401 on any request: `apiClient` interceptor attempts refresh; on failure calls `onUnauthenticated` → `clearSession()` → `setUser(null)`
4. "Remember me = false" uses `sessionStorage` on web (session mode via `storage.setSessionMode(true)`)

`AppNavigator` renders **two trees** on `user === null` — but the logged-out tree is a full guest experience, NOT a login wall:

- **Guest tree** (`user === null`): Onboarding (first run) → `GuestTabNavigator` (GuestHome | LocalSessions | GroupsAuthGate | GuestStats) + local game screens + Login/Register as dismissible modals + guest-aware JoinSession/JoinGroup.
- **Authed tree**: `TabNavigator` + all server-backed screens (unchanged), plus the local game screens (so a guest who logs in mid-game can still reach it).

Both trees expose the route name `MainTabs`. React Navigation swaps trees automatically when `user` changes — no manual `navigation.replace()` needed. Logout lands on guest Home, not a login wall.

**Pending invite handoff:** a guest opening an invite deep link sees "Sign in to join"; the invite is stashed in AsyncStorage (`tpoker.pendingInvite`, 15-min TTL via `utils/pendingInvite.ts`) and `AppNavigator` resumes the join on the null → user transition.

---

## Design System

All colors in `apps/poker-mobile/src/theme/colors.ts`. Never hardcode hex values.

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0F1923` | Screen backgrounds |
| `surface` | `#1A2535` | Cards, inputs, containers |
| `surfaceHigh` | `#1E2D3D` | Elevated/focused surfaces |
| `surfaceAlt` | `#1C2A3A` | Alternate surface |
| `surfaceOverlay` | `rgba(15,25,35,0.85)` | Modal overlays |
| `border` | `#243447` | Borders, dividers |
| `gold` | `#C9A84C` | Primary accent — CTAs, active states |
| `goldLight` | `#E8C97A` | Positive P&L, highlighted amounts |
| `goldDark` | `#A8872E` | Pressed/dark gold |
| `goldFaint` | `rgba(201,168,76,0.08)` | Subtle gold tint background |
| `goldSubtle` | `rgba(201,168,76,0.15)` | Live indicator wrapper |
| `goldMuted` | `rgba(201,168,76,0.40)` | Inactive gold |
| `text` | `#FFFFFF` | Primary text |
| `textHigh` | `#E8EDF2` | Slightly dimmed primary text |
| `textMuted` | `#7A8A99` | Labels, secondary text |
| `textDim` | `#3A4A5A` | Placeholders, disabled |
| `error` | `#E74C3C` | Negative P&L, errors |
| `errorFaint` | `rgba(231,76,60,0.08)` | Error background tint |
| `errorMuted` | `rgba(231,76,60,0.35)` | Error border |
| `success` | `#27AE60` | Positive outcomes |
| `warning` | `#F39C12` | Warnings |
| `bgOverlay` | `rgba(15,25,35,0.6)` | Translucent overlays |

Gold accents are used **sparingly** — only on primary CTAs, live indicators, and key financial numbers. Overusing gold degrades the premium feel.

Typography: `apps/poker-mobile/src/theme/typography.ts` — never hardcode font sizes.
THREE font families: **Inter** (body/base text), **Sora** (UI chrome — headings, tab
labels, buttons), and **DM Serif Display** (`displaySerif`/`amountHero` — screen titles
and hero money numerals ONLY). All load in App.tsx. Inter/Sora ship as separate
per-weight families, so a global `Text`/`TextInput` render patch (`theme/fonts.ts`,
applied once in App.tsx) maps each `fontWeight` to the right face and pins
`fontWeight: normal` (avoids web faux-bold). An explicit `fontFamily` (DM Serif,
ionicons) is always respected. Amount tokens carry an explicit `lineHeight` so the
tall ascent isn't clipped on web.
Spacing/radii: `theme/spacing.ts` (4pt scale) and `theme/radii.ts` — use tokens in new code.
Icons: Ionicons via `@expo/vector-icons`. No emoji as icons in new/redesigned surfaces.
Animations: legacy screens use RN `Animated` (`useNativeDriver: true`); new motion goes
through `components/motion/` (Reanimated 4). Both coexist — don't rewrite old screens wholesale.

**Velvet Table components** (`src/components/`): `Screen` (deep bg + ambient gradient
vignette — wrap screen roots; its `style` prop applies to the content container),
`ScreenHeader` (unified header: title/subtitle/onBack/right, `large` = serif),
`Card` (flat/elevated/hero — hero has a gold gradient hairline border),
`SectionTitle` (caps label; renders children VERBATIM — pass pre-uppercased strings).
`PrimaryButton` has a `gradient` variant (gold gradient) for hero CTAs.

**The Final Count** (end-game step, both LocalSessionScreen and SessionScreen): keep the
canonical copy in sync across both flows — title "The Final Count", subtitle
"Last step — count each player's remaining chips. We'll settle the rest.",
"Busted · ₪0" empty hints, "Counted X of Y on the table" balance indicator,
inline override "End anyway with an unbalanced count", finality footer, and the
"Keep Playing" / "End Game & Settle" button pair.

---

## Copy-honesty rules (standing — owner-set 2026-07-28, born from real blockers)

These are bug classes, not style preferences. Each one shipped (or nearly shipped) at least once.

1. **Moved copy must be re-audited against its DESTINATION's auth and data-flow context.**
   A context-scoped claim re-homed unscoped *inverts its truth value*. Q1.1 moved "Stored on this
   device" off the LOCAL-game wizard (where it was true) onto authed-only ProfileScreen (where the
   user's games are exactly what goes to the server) — true sentence, false in its new home.
   Re-audit: who can actually reach this screen, and is the claim true for *them*?
2. **A kill-switch must never be able to remove a disclosure.** Data-handling statements render
   OUTSIDE feature-flag gates. Flipping `analytics` off silently deleting the on-device statement
   is a compliance defect, not a config option.
3. **Copy that states what ships must be DERIVED from what ships, not hand-written.**
   `tierLabel(dataset)` (which tier) and `datasetScopeLine(dataset)` (what's covered) compute
   their claims from the data, so the copy cannot outrun the content. A hand-written
   "6-max, 100bb" read as a coverage claim while the data covered only opens + big-blind defense.
4. **Never advertise a capability whose flag is OFF in `PROD_FLAGS`** — the `free_ai` reminder
   class, pinned for reminders by `utils/__tests__/reminderLogic.test.ts`. Study-UI claims for
   the `solver`/`coach` flags are *additionally* phrase-banned in
   `features/study/__tests__/tierHonesty.test.ts` — but that ban is a **literal allow-list over
   `features/study/ui` only**: a new phrasing, or any other prod-OFF flag (`bankroll`,
   `mastery`, `paywall`), needs a new entry. Do not read "pinned" as "covered everywhere".
5. **Replacement copy gets audited on its own terms.** Copy written in reaction to a flagged line
   inherits none of the original's review — it is a new claim and needs the same test.

Enforcement lives in `features/study/__tests__/tierHonesty.test.ts` (tier/scope wiring +
vocabulary + flag-claim bans) and `features/premium/__tests__/` (comingSoon/legal pins).

**"Expert-calibrated" is a GOVERNED label — settled 2026-07-28, do not re-litigate.** It comes
from the content workbook's `Pack_Manifests.MarketableAs` field, whose rule is: ≥95% Nash-Solved
or Solver-Verified ⇒ "GTO / Verified-ready", **otherwise "Expert Calibrated"**. That sheet does
not ship to this repo — a grep of the shipped packs will show only row-level
`VerificationTier: Calibrated` and can look like the word was invented in code. It wasn't: the
same rule is encoded in `features/premium/logic/marketableLabel.ts` (`GTO_VERIFIED_THRESHOLD`,
the `expert_calibrated` badge, and the below-threshold degrade branch). "Expert" denotes the
owner's authorship as the domain expert calibrating against published solver consensus; it
asserts no third-party verification. **"Solver-calibrated" was proposed and firmly rejected** —
a user-facing "Solver" prefix on non-solver-verified content reads as solver output, which is
*more* dangerous than "Expert", not less. Rationale is recorded beside the mapping in
`features/study/logic/rangeConvert.ts` and pinned in `tierHonesty.test.ts`.

## Cross-Platform Rules

### Alert.alert() — a NO-OP on web, never use it directly

`Alert.alert()` is a **complete no-op on react-native-web** (`react-native-web`'s
`Alert.alert` is literally `static alert(){}`) — regardless of button count. The
dialog never renders and `onPress` callbacks never fire, so any confirm/destructive
flow silently does nothing on web (native iOS/Android are unaffected). This bit
"Leave Group", "Delete Account", "Delete Session", and others before they were migrated.

Use the web-safe helpers instead:

- **Confirmations** (incl. destructive) → `confirmDialog(title, message, confirmLabel, onConfirm, { destructive })` from `utils/confirm.ts` (`window.confirm` on web, native Alert otherwise).
- **Notices / errors / success** → `showToast(message, 'success'|'error'|'info')` from `utils/toast.ts`.
- **Menus with 3+ options** → the `ActionSheet` component.

```typescript
// ✓ Works everywhere
import { confirmDialog } from '../utils/confirm';
import { showToast } from '../utils/toast';

confirmDialog('Delete?', 'This cannot be undone.', 'Delete', doDelete, { destructive: true });
showToast('Saved.', 'success');

// ✗ Broken on web — Alert.alert renders nothing and the callback never fires
Alert.alert('Delete?', '…', [{ text: 'Cancel' }, { text: 'Delete', onPress: doDelete }]);
```

### Share + Clipboard

`Share.share()` works on iOS/Android only. Web desktop has no Web Share API. Always add a clipboard fallback:

```typescript
try {
  await Share.share({ message, url });
} catch {
  if (Platform.OS === 'web' && navigator?.clipboard) {
    await navigator.clipboard.writeText(url);
    showToast('Link copied!', 'success');
  }
}
```

### Storage

Import from `utils/storage` (not `expo-secure-store` directly) — the wrapper handles web vs native:
- Web: `localStorage` / `sessionStorage`
- Native: encrypted `expo-secure-store`

---

## Environment

### Frontend (`apps/poker-mobile/.env` — gitignored)

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:5062` | Backend API URL |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | — | Android OAuth (production only) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | — | iOS OAuth (production only) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | — | Web/Vercel OAuth (production only) |

Copy `.env.example` → `.env`. Expo Go in development uses the hardcoded Expo proxy client — no env vars needed.

### Backend (`src/PokerApp.API/appsettings.Development.json` — gitignored)

```json
{
  "ConnectionStrings": { "DefaultConnection": "Host=localhost;Database=poker_app_dev;..." },
  "JwtSettings": { "SecretKey": "<min-32-char dev secret>", "Issuer": "PokerApp", "Audience": "PokerApp" },
  "GoogleSettings": { "ClientIds": ["your-google-web-client-id.apps.googleusercontent.com"] }
}
```

**Important:** The config key is `GoogleSettings:ClientIds` (plural, string array), not `ClientId`. `GoogleAuthService` calls `configuration.GetSection("GoogleSettings:ClientIds").Get<IList<string>>()`. Production Railway env var: `GoogleSettings__ClientIds__0=<client-id>`.

---

## Deployment

### Web → Vercel

Build settings live in the Vercel dashboard (Build command
`cd apps/poker-mobile && npx expo export -p web`, Output directory
`apps/poker-mobile/dist`). The project auto-deploys `main`.

**Vercel Root Directory is `apps/poker-mobile`** — so `vercel.json` lives at
`apps/poker-mobile/vercel.json`, NOT the repo root (a repo-root one is silently
ignored; verified empirically — see memory `vercel-root-dir`). It holds the SPA
rewrite `{"source":"/(.*)","destination":"/index.html"}` so deep links like
`/join/group/:token` and `/join/session/:token` resolve to the app instead of
404ing on the static host. Vercel checks the filesystem first, so real files
(`/privacy.html`, JS/asset bundles) still serve before the rewrite.

**Invite-link routing:** the backend builds `https://<WebBaseUrl>/join/group/:token`;
the SPA rewrite serves the app, and React Navigation's `linking` config (in
`AppNavigator`, prefixes `https://app.tpoker.app` + `tpoker://`)
maps the URL to the `JoinGroup`/`JoinSession` screen. Guests are sent to sign-in
and the join resumes after auth via the pending-invite stash.

Live domains: **`tpoker.app`** is the marketing site and the SINGLE public search entry
point; **`app.tpoker.app`** is the web app. `poker-home-games-three.vercel.app` is the
LEGACY deploy URL and redirects to `app.tpoker.app` (make that redirect permanent — see
`docs/release/seo-indexing.md`). `t-poker.vercel.app` is an unrelated third-party site we
do not own — never reference it. The privacy policy is served at the canonical
`https://app.tpoker.app/privacy.html` (declare that URL on the stores).

**Indexing policy (Q1.3):** `app.tpoker.app` is de-indexed via `X-Robots-Tag: noindex` in
`apps/poker-mobile/vercel.json`, because the SPA rewrite answers every path with the same
contentless shell. robots.txt deliberately still ALLOWS crawling — a `Disallow` would stop
crawlers ever seeing the noindex. Pinned by `utils/__tests__/indexingPolicy.test.ts`.

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in Vercel environment settings.

### Mobile → EAS
```powershell
npx eas build --platform ios
npx eas build --platform android
```

### Backend → Railway

The repo root contains a `Dockerfile` that Railway uses automatically. This is necessary because Nixpacks auto-detection fails on monorepos that contain both a `.sln` and a `package.json` — it can misorder the NuGet restore step, causing CS0246 at compile time on Linux. The Dockerfile copies only `src/` and runs an explicit restore+publish against `PokerApp.API.csproj`.

Railway env vars use `__` to separate nested keys. Required vars:
```
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=<Railway PostgreSQL connection string>
JwtSettings__SecretKey=<min-64-char secret>
JwtSettings__Issuer=PokerApp
JwtSettings__Audience=PokerApp
GoogleSettings__ClientIds__0=<google-web-client-id>
AllowedOrigins__0=https://<your-vercel-domain>.vercel.app
AppSettings__WebBaseUrl=https://<your-vercel-domain>.vercel.app
```
All of these override the empty values in `appsettings.Production.json` at runtime.

**Billing is fail-closed in production** (no Railway vars needed): `BillingVerifierSelection` disables any
non-`direct` verifier in Production (the mock verifier — which grants premium for any receipt — is
dev/test-only), `appsettings.Production.json` pins `BillingSettings` to `direct` + `AcceptSandbox=false`,
and `AcceptSandbox` defaults to `false` in code. Pinned by `BillingFailClosedProdTests`. At app-store
billing launch, supply real store credentials via env (`AppleStoreSettings__*`, `GooglePlaySettings__*`, …) —
do NOT set `BillingSettings__Provider=mock` in production.

**`IWebSettings` — invite link base URL:**
`IWebSettings` is defined in `Application/Common/Interfaces/IWebSettings.cs` and implemented by `Infrastructure/Settings/WebSettings.cs` (bound from `AppSettings:WebBaseUrl`). It is injected into `GenerateGroupInviteLinkCommandHandler` and `GenerateSessionInviteTokenCommandHandler`. When `WebBaseUrl` is empty (local dev, Expo Go), invite URLs use the `tpoker://` deep-link scheme. When set, they use `https://<WebBaseUrl>/join/group/:token` and `https://<WebBaseUrl>/join/session/:token`.

**Linux/case-sensitivity pitfalls (for future changes):**
- C# namespaces are case-sensitive; always match `namespace` declarations exactly in `using` directives
- SDK-style `.csproj` files auto-glob `**/*.cs` — file names must be an exact case-match of what the compiler expects; mismatches are silently ignored on Windows but cause CS0246 on Linux
- Never run `dotnet publish --no-restore` on a fresh Linux environment without running `dotnet restore` first — the Dockerfile handles this correctly with explicit `RUN dotnet restore` before `RUN dotnet publish --no-restore`
- The `out/` build artifact directory is gitignored — never commit it

---

## V2 Features (Phase A — implemented)

### Player Profiles + Head-to-Head Stats (Phase A1)

- `GET /api/users/{userId}/profile` — career stats (sessions, P&L, streaks, W/L, recent form). Requires shared group membership (privacy guard).
- `GET /api/users/{userId}/head-to-head` — W/L record + net P&L in sessions where both users played. Requires shared group.
- Frontend: `PlayerProfileScreen` — hero card, stat grid, W/L record, form dots, H2H card, recent sessions. Access via tap on member name in `GroupDetailScreen` or player name in `SessionScreen` (registered users only).
- DB indexes added: `IX_SessionPlayers_UserId`, `IX_Sessions_CreatorId` (migration `Phase37_AddMissingIndexes`).

### Session Recaps (Phase A2)

- `GET /api/sessions/{id}/recap` — post-game recap computed on-demand from existing data. Only available for Finished sessions. Returns: duration, total pot, player count, hand count, biggest winner/loser, biggest pot from hand records, ordered leaderboard, and up to 6 narrative highlight strings.
- Frontend: `RecapCard` component (`components/RecapCard.tsx`) — collapsible card with gold left-border accent, 4-stat row (Duration / Total Pot / Players / Hands), narrative highlights list, and "Share Recap" button. Inserted between Results and Settlements sections in `SessionScreen` when `isFinished`.
- `shareSessionCard()` in `exportUtils.ts` now accepts optional `highlights?: string[]` which appear as a "Highlights" section in the shared PDF above the results table.
- No new entities — everything computed from existing `BuyIn`, `CashOut`, `SessionPlayer`, and `HandRecord` tables.

---

## V2 Features (Phase B — Premium UX)

### Streak Tracking (B/C2)

- `MyStatsDto` now includes `CurrentStreak: int` and `LongestWinStreak: int`.
  - `CurrentStreak` > 0 = active win streak; < 0 = active loss streak; 0 = broken or no sessions.
  - `LongestWinStreak` = all-time best consecutive wins.
- `statsApi.ts` `MyStatsDto` type updated with `currentStreak` and `longestWinStreak` fields.
- `HomeScreen`: streak chip (🔥 win / ❄️ loss) appears below the hero P&L card when `currentStreak !== 0`.
- `StatsScreen`: dedicated streak section between Key Numbers and P&L Trend showing current streak + best streak cards.

### Skeleton Loading System (B1)

- `SkeletonRow` component (`components/SkeletonRow.tsx`) — reusable animated shimmer row with left accent strip, content area, and right value placeholder.
- All screens now render structured skeleton layouts on load instead of a bare `ActivityIndicator`:
  - `StatsScreen` — hero card, 3-col stats row, chart block, session rows
  - `AllSessionsScreen` — title + active card + session list rows
  - `GroupsListScreen` — 4 group rows
  - `SessionsListScreen` — 4 session cards

### Entrance Animations (B3)

- `useScreenEntrance` hook (`hooks/useScreenEntrance.ts`) — triggers a fade-in + slide-up on every screen focus via `useFocusEffect`. Returns `{ opacity, translateY, style }`.
- Applied to `AllSessionsScreen`, `GroupsListScreen`. Use `<Animated.View style={entrance.style}>` to wrap screen content.

### EmptyState Enhancement (B2)

- `EmptyState` component now supports an optional `ionicon` prop (`React.ComponentProps<typeof Ionicons>['name']`). When provided, renders an Ionicons icon in a styled circle instead of an emoji. Falls back to the original `icon: string` prop if no `ionicon` is passed.

### Entry experience (supersedes the old B5 onboarding — reality as of PR #14 + free-first)

The prod cold-start flow is a three-stage funnel, all flag-gated in `src/config/features.ts`
(`v2Splash` / `welcome` / `onboardingV2`, all ON):

1. **BrandSplash** overlay (~1.2s, tap-to-skip, reduced-motion safe; mounted in App.tsx).
2. **WelcomeScreen** chooser — explicit "Continue as guest" / "Sign in", ZERO guest-data writes
   (test-pinned). The choice is also the ANALYTICS CONSENT boundary (Wave 0.2).
3. **OnboardingV2Screen** (first run only) — 4 pillar slides (Learn → Practice → Play → Track) +
   a "Where do you want to start?" action router that `navigation.reset`s into a real flow.

Routing decisions are pure + Jest-pinned in `navigation/entryRouting.ts`; `AppNavigator` gates
the Onboarding route on the single storage boolean `hasSeenOnboarding`. The legacy 3-slide
`OnboardingScreen` still exists only as the `onboardingV2`-off fallback (never renders — the
flag is ON everywhere).

### Response Compression (D3)

- `Program.cs` now wires `AddResponseCompression(opts => opts.EnableForHttps = true)` and `app.UseResponseCompression()` — applies Brotli/gzip compression to all responses including HTTPS.

---

## V2 Features (Phase C — Social & Retention)

### Achievements & Badges System (C1)

**New domain entities:**
- `Achievement` (`Domain/Entities/Achievement.cs`) — static catalog entity (does NOT extend `BaseEntity`). Properties: `Id`, `Key`, `Name`, `Description`, `IconKey`, `AchievementRarity`.
- `UserAchievement` (`Domain/Entities/UserAchievement.cs`) — extends `BaseEntity`. Properties: `UserId`, `AchievementKey`, `UnlockedAt`. Factory: `UserAchievement.Create(userId, key)`.
- `AchievementRarity` enum (`Domain/Enums/AchievementRarity.cs`): `Common=0, Rare=1, Epic=2, Legendary=3`.

**EF configuration:**
- `AchievementConfiguration.cs` — unique index on `Key`, seed data for 14 achievements via `HasData()` with stable GUIDs (`10000000-0000-0000-0000-00000000000x`).
- `UserAchievementConfiguration.cs` — FK to User (cascade delete), unique composite index on `(UserId, AchievementKey)`.
- Migration: `Phase38_AchievementsAndStreaks`.

**Achievement catalog (seeded):**

| Key | Criteria |
|-----|----------|
| `first_session` | Complete first session |
| `ten_sessions` | Play 10 sessions |
| `fifty_sessions` | Play 50 sessions |
| `first_win` | Win first session |
| `five_win_streak` | Win 5 in a row |
| `profit_100` | Reach $100 total P&L |
| `profit_1000` | Reach $1,000 total P&L |
| `profit_5000` | Reach $5,000 total P&L |
| `comeback` | Lose $200+, win the next session |
| `marathon` | Session lasting 4+ hours |
| `triple_rebuy` | 3+ buy-ins in a single session |
| `cash_out_even` | Cash out exactly break-even |
| `hand_historian` | Log 10+ hand records |
| `first_group` | Join or create a group |

**Application layer:**
- `IAchievementEvaluator` (`Application/Common/Interfaces/IAchievementEvaluator.cs`) — `EvaluateAsync(userId, sessionId, cancellationToken)` returns newly unlocked keys.
- `AchievementEvaluator` (`Infrastructure/Services/AchievementEvaluator.cs`) — evaluates all unearned achievements after a session ends. Called from `EndSessionCommandHandler` after `SaveChangesAsync`.
- `GetMyAchievementsQuery` + handler + DTO in `Application/Features/Users/Queries/GetMyAchievements/`.

**API endpoint:**
- `GET /api/users/me/achievements` → `MyAchievementsDto { Earned: AchievementDto[], Locked: AchievementDto[] }`.

**Frontend:**
- `achievementsApi.ts` (`api/achievementsApi.ts`) — `getMyAchievements(token)`.
- `StatsScreen` — achievements section below the P&L trend. Earned badges full-color (rarity tint), locked at 45% opacity. Rarity colors: Common=textMuted, Rare=#4EAADC, Epic=#C46EE8, Legendary=gold. Sorted: earned (desc by unlockedAt) then locked, separated by a divider.
- Loaded alongside stats via `Promise.all` with `.catch(() => null)` fallback so a cold DB (pre-migration) doesn't break the screen.

**Important implementation note:** EF Core does NOT have `ToHashSetAsync`. Use `.ToListAsync(ct).ToHashSet()` instead.

---

## V2 Features (Phase D — Platform & Scale)

### Period-Based Stats (A3 / Phase 39)

- `GetMyStatsQuery` now accepts an optional `Period` parameter: `"week" | "month" | "year"` (default = all-time).
- `AuthController.GetMyStats` accepts `[FromQuery] string? period`.
- Streak fields (`CurrentStreak`, `LongestWinStreak`) are always computed from all-time data — only aggregate stats and `RecentSessions` are period-filtered.
- `statsApi.ts` `getMyStats(token, period?)` accepts an optional period param.
- `StatsScreen` has a 3-tab period picker (This Week / This Month / All Time) at the top. Tabs trigger a re-fetch; hero label updates to match the period. All stat cards, the chart, and session list reflect the selected period.
- `HomeScreen` computes "this week" P&L client-side from already-loaded `recentSessions` and displays it as a color-coded chip below the hero P&L when sessions exist in the last 7 days.

### Weekly digest + top movers (undocumented until 2026-07-22 — live, unflagged)

- `GET /api/users/me/weekly-digest` → `WeeklyDigestDto { sessionsPlayed, netProfitLoss,
  bestNight?: { sessionId, sessionName, profitLoss }, totalMinutesPlayed,
  mostActiveGroup?: { groupId, groupName, gamesCount }, currentStreak }` — rolling UTC last-7-days
  window computed on-demand from the caller's OWN history (`GetWeeklyDigestQueryHandler`; caller-only,
  no persisted snapshots, no calendar-week bucketing — NOT a weekly-cadence primitive). `bestNight`
  and `mostActiveGroup` are nested sub-records, not flat scalars.
- Client: `api/digestApi.ts`; HomeScreen fetches it on every focus and renders the
  **"Your Poker Week"** hero card (renamed from "Your Week at the Club" in 1.6; or a quiet-week
  prompt). Extend THIS card for weekly-crew surfaces — never add a parallel weekly card.
- **Top movers (2.5):** the card shows a "Top movers this week" row — the most-active group's weekly
  leaderboard WINNERS (reuses `getGroupLeaderboard(groupId,'week')` + pure `utils/topMovers.ts`;
  no new backend). Tapping it opens that group via the `GroupDetail` route's new `focusLeaderboard`
  param, which preselects the Week period and scrolls the leaderboard section into view.

### In-App Notifications (D1 / Phase 40)

**New domain entity:**
- `Notification` (`Domain/Entities/Notification.cs`) — extends `BaseEntity`. Properties: `UserId`, `Type` (NotificationType enum), `Title`, `Body`, `RelatedEntityId` (nullable), `IsRead`. Factory: `Notification.Create(userId, type, title, body, relatedEntityId?)`.
- `NotificationType` enum (`Domain/Enums/NotificationType.cs`): `SessionEnded=0, SettlementCreated=1, SettlementPaid=2, GroupInviteReceived=3, AchievementUnlocked=4, GroupJoined=5, MemberRemoved=6`.
- `NotificationConfiguration.cs` — composite index on `(UserId, IsRead)`, cascade delete on User FK.
- Migration: `Phase39_Notifications`.

**Application layer:**
- `INotificationService` — `NotifyAsync(userId, type, title, body, relatedEntityId?)` and `NotifyManyAsync(userIds, ...)`.
- `NotificationService` (`Infrastructure/Services/NotificationService.cs`) — stores in DB; registered as `INotificationService` in DI.
- `GetMyNotificationsQuery` + handler returns `{ Notifications: NotificationDto[], UnreadCount: int }` (last 50, newest first).
- `MarkAllNotificationsReadCommand` + handler — marks all user's unread notifications as read.
- Wired into: `EndSessionCommandHandler` (notifies all other registered session players), `MarkSettlementPaidCommandHandler` (notifies the other party).

**API endpoints:**
- `GET /api/notifications` → `GetMyNotificationsResponse`.
- `POST /api/notifications/read-all` → 204.

**Frontend:**
- `notificationsApi.ts` — `getMyNotifications(token)`, `markAllNotificationsRead(token)`.
- `NotificationsScreen` (`screens/NotificationsScreen.tsx`) — shows notification list with type-specific icons, unread dot, "Mark all read" button, timeAgo labels. Gold bell for unread, empty state when all caught up.
- `HomeScreen` — bell icon in header now navigates to `Notifications` screen. Unread badge (gold dot) appears when `unreadCount > 0` OR pending invitations exist. Also fetches unread count on focus via `getMyNotifications` in the existing `Promise.all`.
- `AppNavigator` — added `Notifications: undefined` to `RootStackParamList` and `<Stack.Screen name="Notifications">`.

### Group Rivals (Phase 41)

**Backend:**
- `GetGroupRivalsQuery` (`Application/Features/Groups/Queries/GetGroupRivals/`) — for a given group, computes the top 5 most-played player pairs. For each pair: sessions together, each player's net P&L across those shared sessions.
- `GroupRivalryDto`: `Player1Id, Player1Username, Player1NetPL, Player2Id, Player2Username, Player2NetPL, SessionsTogether`.
- Authorization: caller must be a group member.
- `GET /api/groups/{id}/rivals` → `List<GroupRivalryDto>`.

**Frontend:**
- `groupsApi.ts` — added `GroupRivalryDto` type and `getGroupRivals(token, groupId)`.
- `GroupDetailScreen` — new "Rivalries" section (above Activity feed) showing top 5 rivalries: "X sessions together", each player's net P&L with color coding. Section hidden when group has fewer than 2 players or no finished sessions.
- `RivalryRow` component inline in `GroupDetailScreen`.

### Cross-Group Activity Feed (Phase 42)

**Backend:**
- `GetCrossGroupActivityQuery` (`Application/Features/Groups/Queries/GetCrossGroupActivity/`) — returns the 10 most recent activity events across all groups the caller belongs to.
- `CrossGroupActivityDto`: `Id, GroupId, GroupName, ActorName, Type, Description, CreatedAt`.
- `GET /api/groups/activity` → `List<CrossGroupActivityDto>`. No route conflict with `GET /api/groups/{id:guid}/activity` (different path depth).

**Frontend:**
- `groupsApi.ts` — added `CrossGroupActivityDto` type and `getCrossGroupActivity(token)`.
- `utils/formatters.ts` — added `timeAgo(dateStr)` utility (now shared; also used inline in `NotificationsScreen`).
- `HomeScreen` — new "Recent Activity" section at the bottom showing the last 5 cross-group events, each with an icon (based on activity type), description, group name badge (gold), and time-ago label. Only rendered when the user has group activity.
- `HomeScreen` — new "Pending Invitations" banner between the settlements alert and the New Game CTA. Shows when `invitations.length > 0` with a gold mail icon, taps to `Invitations` screen.

### Group Leaderboard Period Filter (Phase 43)

- `GetGroupLeaderboardQuery` now accepts `Period: string?` (`"week"`, `"month"`, or `null` for all-time).
- `GetGroupLeaderboardQueryHandler` applies `CreatedAt >= cutoff` filter to finished sessions before computing rankings.
- `GET /api/groups/{id}/leaderboard?period=week|month` — optional query param.
- `groupsApi.ts` `getGroupLeaderboard(token, groupId, period?)` accepts optional period.
- `GroupDetailScreen` leaderboard section now has 3-tab period picker (Week / Month / All Time) above the leaderboard. Changing tabs calls `loadLeaderboard(period)` (a separate async function from the main `load()`) without reloading the entire screen. Shows "No sessions in this period" empty state when filtered results are empty.

### Invitation Notification + AllSessions Group Filter (Phase 44)

- `InviteUserToGroupCommandHandler` now injects `INotificationService` and sends a `GroupInviteReceived` notification to the invited user after saving. Wrapped in try/catch (non-critical).
- `AllSessionsScreen` — group filter chips above the "Recent Sessions" list. Unique group names extracted from loaded sessions; a "Clear filter" link appears when active. Chips are horizontal-scrollable. Filtering is entirely client-side.

### Per-Group P&L in Group Lists (Phase 45)

**Backend:**
- `MyGroupDto` extended with `MyGroupPL: decimal?` (null if user has no finished sessions in the group) and `MyGroupSessions: int`.
- `GetMyGroupsQueryHandler` now runs 3 additional queries after fetching memberships: user's session players in finished group sessions, buy-ins, and cash-outs. Computes per-group P&L and session count in-memory. Total queries: 4 (previously 1).

**Frontend:**
- `groupsApi.ts` `MyGroupDto` type updated with `myGroupPL: number | null` and `myGroupSessions: number`.
- `GroupListItem` component — added `myGroupPL?` and `myGroupSessions?` props. The meta line now shows "X sessions" and a green/red P&L chip aligned right.
- `HomeScreen` and `GroupsListScreen` both pass the new props to their group renderers.

### Total Time Played stat (Phase 47)

- `MyStatsDto` extended with `TotalMinutesPlayed: long` — sum of `(EndedAt - StartedAt)` minutes across finished sessions the user played. Reflects the active `period` filter.
- `GetMyStatsQueryHandler` computes the total from in-memory finished sessions (no extra DB query).
- Frontend: `statsApi.ts` `MyStatsDto` adds `totalMinutesPlayed`. `formatters.ts` adds `formatMinutes(totalMinutes)` returning `1h 23m` / `45m` / `—`. `StatsScreen` adds a "Time Played" `HighlightCard` in the Key Numbers row.

### Production middleware restoration (Phase 46)

- Restored `Program.cs` after Phase 33d stripped DI/auth/rate-limiter/exception-middleware. See commit `36b1e45` — all `[Authorize]`, `[EnableRateLimiting]`, and `IMediator`-using endpoints were 500-ing in production.
- `Program.cs` now reads CORS allow-list from `AllowedOrigins` configuration (Railway: `AllowedOrigins__0=https://<vercel-domain>`) with a hardcoded fallback to the production Vercel domain.
- **Critical pipeline order:** `UseForwardedHeaders` (prod only) → `SecurityHeadersMiddleware` → `UseCors` → `UseMiddleware<ExceptionHandlingMiddleware>` → `UseResponseCompression` → `UseAuthentication` → `UseRateLimiter` → `UseAuthorization` → `MapControllers`. **`UseAuthentication` precedes `UseRateLimiter`** so the `coach-analyze` limiter can partition per authenticated user (audit M2); `UseForwardedHeaders` de-proxies the client IP so the auth limiters partition per real client IP behind Railway (audit H1). Rate-limit partition keys live in `PokerApp.Application.Common.RateLimitKeys` (pure/tested); `Program.cs` supplies the IP / user-id claim.

---

## Out of Scope (decided, not returning)

- i18n / Hebrew / RTL — English only
- WebSockets / SignalR — 30s polling is sufficient
- Blind level tracking, debt system — removed
- Push notifications — post-MVP
- Offline-first caching — network required
- Payment integration — cash settled offline
