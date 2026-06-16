# T Poker — Technical Handoff

The definitive engineering handoff for **T Poker** by **True Story Labs**. Pairs with
[`../CLAUDE.md`](../CLAUDE.md) (deep conventions), [`store-release.md`](store-release.md)
(submission), and [`release-readiness.md`](release-readiness.md) (launch status).

_Last updated: June 16, 2026 · App v1.1.0 · Production live (Vercel + Railway)._

---

## 1. Product Overview

**Purpose.** A premium live-poker home-game manager for private friend groups —
tracks buy-ins, cash-outs, settlements, tournaments, and lifetime stats. Positioned as a
**scorekeeping / expense-settlement tool for adults (18+)**, *not* a gambling product
(no wagering, real-money play, or payouts).

**Core features.** Guest (on-device, no account) and cloud (account) play · cash games
with **The Final Count** end flow · a local-first **tournament director** (custom payouts,
editable blinds, controllable clock, late-reg, rebuys/add-ons, podium) · greedy
debt-minimization **settlements** · **groups** (roles, invite links, leaderboards,
rivalries, activity) · **stats** (lifetime/period P&L, streaks, W/L/E) · **14 achievements**
· in-app + push **notifications** · share cards.

**User roles & flows.**
- **Guest** — opens straight into the app (no login wall); runs full cash/tournament games
  on-device (AsyncStorage); Groups/Stats tabs upsell sign-in.
- **Account user** — cloud sync, groups, personal stats/achievements, notifications.
- **Group roles** — `Owner` (one; FK-restricted, can't be deleted while owning), `Admin`,
  `Member`. Role gates group/session mutations.

## 2. Architecture

Monorepo: `apps/poker-mobile` (Expo, iOS/Android/Web) + `src/` (.NET 8 backend).

**Frontend** — Expo SDK 54 / React Native 0.81 / React 19, TypeScript strict. Each screen
owns its state + data fetching (no global store), refetching on focus (`useFocusEffect`).
Two trees in `navigation/AppNavigator.tsx` branch on `user === null` (guest vs authed);
both expose `MainTabs`. Contexts: `AuthContext` (session), `ActiveSessionContext`
(LiveGameBar, 30s poll), `LocalGamesContext` (guest games). Design tokens in `theme/`;
motion in `components/motion/` (Reanimated 4) over legacy RN `Animated`.

**Backend** — Clean Architecture + CQRS. Dependency rule `Domain ← Application ←
Infrastructure ← API`. Every mutation is a MediatR `Command`, every read a `Query`
(`Application/Features/<Feature>/...`), commands validated by FluentValidation. Controllers
are thin (extract user → send command → status code). `ExceptionHandlingMiddleware` maps
domain exceptions → HTTP (`NotFound`→404, `BadRequest`→400, `Validation`→400,
`Conflict`→409, `Unauthorized`→401, `UnauthorizedAccess`→403).

**Infrastructure** — Railway runs the API (root `Dockerfile`); Vercel serves the web export;
EAS builds native; PostgreSQL is the system of record. Guest data never leaves the device.

## 3. Technology Stack

| Area | Tech |
|------|------|
| Mobile/Web | Expo SDK 54, React Native 0.81, React 19, TypeScript strict, React Navigation |
| Motion/UI | Reanimated 4, gesture-handler, expo-haptics, expo-blur, expo-linear-gradient |
| Typography | **DM Serif Display** (display + hero numerals) · **Sora** (headings/labels/UI) · **Inter** (body + tabular) — global weight→family resolver in `theme/fonts.ts` |
| Backend | ASP.NET Core 8, MediatR (CQRS), FluentValidation, EF Core 8 (Npgsql) |
| Database | PostgreSQL |
| Auth | JWT (15-min access) + rotating refresh (30-day, SHA-256 hashed at rest), Google OAuth, BCrypt |
| Notifications | In-app inbox + Expo Push (native only; `DeviceToken` + `ExpoPushService`, best-effort) |
| Deploy | Railway (API, Docker), Vercel (web), EAS (iOS/Android) |
| Testing | Jest (settlement engine, local store, money/tournament utils) |

## 4. Database

**Entities** (`src/PokerApp.Domain/Entities`): `User`, `Group`, `GroupMember`,
`GroupInvitation`, `GroupInviteLink`, `Session`, `SessionPlayer`, `BuyIn`, `CashOut`,
`Settlement`, `HandRecord`, `RefreshToken`, `Notification`, `DeviceToken`, `Achievement`,
`UserAchievement`, `ActivityLog`. Most extend `BaseEntity` (`Id` Guid, `CreatedAt`,
`UpdatedAt`); `Achievement` is a static seeded catalog.

**Key relationships.** `User` 1—* `GroupMember` *—1 `Group`; `Group` 1—* `Session` 1—*
`SessionPlayer` 1—* `BuyIn`/`CashOut`; `Session` 1—* `Settlement`/`HandRecord`;
`User` 1—* `RefreshToken`/`Notification`/`DeviceToken`/`UserAchievement`. EF configs live in
`src/PokerApp.Infrastructure/Persistence/Configurations`; migrations in
`src/PokerApp.Infrastructure/Persistence/Migrations`.

**Important business rules.**
- **Group owner FK is `Restrict`** — a user who owns a group cannot be deleted (must transfer
  or delete the group first); enforced in `DeleteAccountCommandHandler`.
- **Session lifecycle** `Draft → Active → Finished` (group sessions; guest games skip Draft).
  Finished is read-only except settlement marking.
- **`SessionPlayer`** is a registered user (`UserId`) or guest (`GuestName`), optionally
  `LinkedUserId`; `SettlementUserId = LinkedUserId ?? UserId`. Account deletion **anonymizes**
  session players (nulls `UserId`) to preserve historical session integrity.
- **Settlements** = greedy two-pointer debt minimization; the TS port (`apps/poker-mobile/src/local/settlements.ts`)
  must stay byte-for-byte equivalent to `SettlementCalculatorService.cs` (pinned by shared Jest fixtures).
- **Achievements** are evaluated only on `EndSession` (`AchievementEvaluator`).
- **Local games** are at AsyncStorage schema v3 (`mode: cash | tournament`); corrupt payloads
  are quarantined, never wiped.

## 5. Application Flows

- **Auth/authorization** — register/login → access (15m) + refresh (30d, hashed, rotating with
  reuse detection); the mobile `apiClient` refreshes transparently via a single-flight 401
  interceptor; on refresh failure → logout. Google OAuth via `GoogleSettings:ClientIds`.
- **Groups & invitations** — two systems: permanent regeneratable **group invite links**
  (`GroupInviteLink`, `/join/group/:token`) and single-use 24h **session invite tokens**
  (`/join/session/:token`). Guests opening an invite get "sign in to join" and the join
  **resumes after auth** (pending-invite stash). Roles gate mutations.
- **Sessions & tournaments** — group sessions on the server (Draft→Active→Finished);
  guest games local-only. Tournament director: payouts (largest-remainder), editable blinds,
  stored clock (pause/resume/jump), late-reg, rebuys/add-ons, eliminations, early finish.
- **Statistics** — `GetMyStats` (optional `week|month|year` period); lifetime P&L, W/L/E,
  win rate, streaks, biggest win/loss, time played; P&L trend chart; group leaderboards.
- **Achievements** — 14-key seeded catalog; unlocked on session end; surfaced on Stats with a
  rarity-tinted **Achievement Unlock** celebration (per-user "seen" baseline, no retroactive burst).
- **Notifications** — `INotificationService` writes rows (SessionEnded, SettlementPaid,
  GroupInviteReceived, AchievementUnlocked, …); inbox fetch-on-focus; Expo push best-effort
  after the DB write (wrapped in try/catch — push never fails a command).

## 6. Deployment

**Production URLs**
- Web: `https://poker-home-games-three.vercel.app` · Privacy: `…/privacy.html` (+ `#delete`)
- API: `https://poker-home-games-production.up.railway.app` (health: `/health`)

**Railway (API).** Root `Dockerfile` (explicit restore+publish of `PokerApp.API.csproj` —
Nixpacks misorders restore on this monorepo). Health check in `railway.toml`. EF migrations
run on startup. Env vars use `__` for nesting (see §Environment).

**Vercel (web).** **Root Directory = `apps/poker-mobile`** (so `vercel.json` and config live
there, *not* repo root). Build `cd apps/poker-mobile && npx expo export -p web`, output
`apps/poker-mobile/dist`. `apps/poker-mobile/vercel.json` SPA rewrite routes deep links
(`/join/...`) to `index.html`. Auto-deploys `main`. PR/branch builds get preview URLs;
the prod CORS policy allows this project's Vercel previews.

**EAS (mobile).** `eas build --profile production --platform ios|android`, then `eas submit`.
`autoIncrement` bumps build numbers; bump human `version` in `app.json` per release.

**Environment variables** (full table in [`../README.md`](../README.md#environment-variables)):
frontend `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_GOOGLE_*`; backend
`ConnectionStrings__DefaultConnection`, `JwtSettings__SecretKey/__Issuer/__Audience`,
`GoogleSettings__ClientIds__0`, `AllowedOrigins__0`, `AppSettings__WebBaseUrl`,
`ASPNETCORE_ENVIRONMENT`.

**Deployment process.** Merge/push to `main` → Vercel auto-deploys web + Railway redeploys API.

**Rollback.**
- Web: Vercel dashboard → Deployments → promote the previous good deployment (instant), or
  revert the commit on `main`.
- API: Railway → Deployments → redeploy/roll back to the prior image; or revert + push.
- Always pair with a `git revert` so the repo matches the live state.

## 7. Assets

- **Store assets:** `apps/poker-mobile/store-assets/` — `icon-1024.png`, `icon-512.png`,
  `feature-graphic-1024x500.png`, `adaptive-icon-fullbleed.png`, `README.md`.
- **Screenshots:** `apps/poker-mobile/store-assets/screenshots/{play-phone, ios-6.7, ios-5.5}/`
  (`01-home … 06-stats`, exact store sizes 1080×1920 / 1290×2796 / 1242×2208). Regenerate via
  the Playwright harness (`store-shots.js`) after visual changes; README embeds the play-phone set.
- **App branding:** `apps/poker-mobile/assets/` (`icon.png`, `adaptive-icon.png`, `splash-icon.png`,
  `logo.png`). Logo also drives the in-app `BrandHeader` home anchor.

## 8. Development

**Setup.** Prereqs: .NET 8 SDK, Node 18+, PostgreSQL.
1. `cd apps/poker-mobile && npm install`
2. Create `src/PokerApp.API/appsettings.Development.json` (connection string + JWT + Google) —
   template in [`../README.md`](../README.md#quickstart).
3. `cd src/PokerApp.Infrastructure && dotnet ef database update --startup-project ../PokerApp.API`

**Run.** API: `cd src/PokerApp.API && dotnet run --launch-profile http` (→ `:5062`, Swagger `/swagger`).
Web: `cd apps/poker-mobile && npm run web`. Device: `npm start` (Expo Go).
> Guest mode works with no backend; account features need the API running (otherwise web
> shows `ERR_CONNECTION_REFUSED` against `localhost:5062`).

**Build/test.** `npx tsc --noEmit` · `npx jest` (frontend) · `dotnet build PokerApp.sln`.
New migration: `cd src/PokerApp.Infrastructure && dotnet ef migrations add <Name> --startup-project ../PokerApp.API`.

**Release.** `eas build --profile production -p all` → `eas submit`. Web ships on merge to `main`.

**CI/CD.** No formal CI pipeline; deployment is git-driven (Vercel + Railway watch `main`).
Pre-merge gate is local (`tsc`/`jest`/`dotnet build`) + the Playwright verification harness
(see `%TEMP%\tpoker-verify` recipe in CLAUDE.md / memory). Recommended future addition: a
GitHub Actions workflow running tsc + jest + dotnet build on PRs.

## 9. Quality & Operations

**Monitoring/diagnostics.** Railway `/health` + service logs; Vercel build/runtime logs;
`ExceptionHandlingMiddleware` returns a `TraceId` on 500s. No external APM/error-tracking yet.

**Known limitations** (intentional, see CLAUDE.md "Out of Scope"): English-only (no i18n/RTL);
30s polling instead of WebSockets/SignalR; network required (no offline-first); push is
native-only (no web push); payments settled offline.

**Technical debt.** Two Axios patterns coexist (`apiClient` with auto-refresh vs per-call
instances); legacy RN `Animated` and Reanimated 4 coexist by design (don't rewrite old screens
wholesale); `react-native-web` `Alert.alert` is a **no-op** — always use
`utils/confirm.ts` (`confirmDialog`) / `utils/toast.ts` (`showToast`), never raw `Alert.alert`.

**Security.** SHA-256-hashed refresh tokens with rotation + reuse detection; per-IP rate limits
on auth endpoints; production CORS allow-list (+ scoped Vercel-preview predicate); role checks
at handler level; amount validation on every transaction; secrets only via env vars
(`appsettings.Development.json` and `.env` are gitignored). Privacy: [`../PRIVACY.md`](../PRIVACY.md);
in-app account deletion (Profile → Delete Account) + deletion URL.

## 10. Future Planning

**Roadmap** — full list in [`roadmap-v2.md`](roadmap-v2.md). Headline: server-side group
tournaments → push-delivery rollout → local-to-cloud game import → native universal links
(AASA + Android asset verification).

**Recommended next features.** Server-backed tournaments (parity with the local director);
richer group analytics; CSV/PDF export polish; optional realtime via SignalR if polling proves limiting.

**App Store improvements.** Build + submit the iOS app (paid Apple account, `eas build -p ios`),
fill `eas.json` `appleTeamId`/`ascAppId`, Privacy Nutrition + 17+ rating, TestFlight pass.

**Google Play improvements.** Create the Play Console app, upload the production AAB to the
Internal testing track, complete Data Safety (deletion URL) + content rating (answer *no* to
gambling) + Lifestyle/Tools category, device QA, then promote to Production.

---

_See also: [`../README.md`](../README.md) · [`../CLAUDE.md`](../CLAUDE.md) ·
[`store-release.md`](store-release.md) · [`release-readiness.md`](release-readiness.md) ·
[`CHANGELOG.md`](CHANGELOG.md) · [`roadmap-v2.md`](roadmap-v2.md)._
