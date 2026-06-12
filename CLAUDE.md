# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Product Vision

T Poker is a premium live poker home-game management platform for private friend groups. It tracks buy-ins, cash-outs, settlements, and lifetime statistics across sessions and groups.

**Core principle:** The live session screen is the critical path — it must work flawlessly, with minimal taps and no blocking UI. Everything else is secondary.

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

There are **two Axios patterns** in use:
- `api/apiClient.ts` — a shared Axios instance with a 401 interceptor that automatically refreshes the token and retries the request. Use this for any API call that should trigger auto-logout on refresh failure.
- Individual API files (`sessionsApi.ts`, `groupsApi.ts`, etc.) — each creates its own Axios instance per call, taking an explicit `token` argument. Most screens use this pattern.

Both read tokens from `utils/storage.ts`, never from context.

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
Icons: Ionicons via `@expo/vector-icons`.  
Animations: `Animated` from React Native, `useNativeDriver: true` always.

---

## Cross-Platform Rules

### Alert.alert()

`Alert.alert()` with **3+ buttons** is broken on React Native Web. Use the `ActionSheet` component for any menu with 3+ options.

`Alert.alert()` with exactly 2 buttons (Cancel + action) works on web via `window.confirm()`.

```typescript
// ✓ Works everywhere (2 buttons)
Alert.alert('Delete?', 'This cannot be undone.', [
  { text: 'Cancel', style: 'cancel' },
  { text: 'Delete', style: 'destructive', onPress: doDelete },
]);

// ✗ Broken on web — use <ActionSheet> instead
Alert.alert('Options', undefined, [buttonA, buttonB, buttonC, cancelButton]);
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
  "JwtSettings": { "Secret": "...", "Issuer": "TPoker", "Audience": "TPokerUsers" },
  "GoogleSettings": { "ClientIds": ["your-google-web-client-id.apps.googleusercontent.com"] }
}
```

**Important:** The config key is `GoogleSettings:ClientIds` (plural, string array), not `ClientId`. `GoogleAuthService` calls `configuration.GetSection("GoogleSettings:ClientIds").Get<IList<string>>()`. Production Railway env var: `GoogleSettings__ClientIds__0=<client-id>`.

---

## Deployment

### Web → Vercel

`vercel.json` is at the repo root:
```json
{
  "buildCommand": "cd apps/poker-mobile && npx expo export -p web",
  "outputDirectory": "apps/poker-mobile/dist",
  "framework": null
}
```
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

### Onboarding First-Run (B5)

- `OnboardingScreen` (`screens/OnboardingScreen.tsx`) — 3-slide horizontal carousel shown to new users on first launch. Slides: "Track Every Game" / "Play With Your Crew" / "Know Your Numbers". Skip button on slides 0–1. On complete, stores `hasSeenOnboarding = 'true'` in `utils/storage` and navigates to Login.
- `AppNavigator` reads `hasSeenOnboarding` on startup and renders `<Stack.Screen name="Onboarding">` first if not set. Delays all rendering until both `isLoading === false` AND `hasSeenOnboarding !== undefined`.

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
- **Critical pipeline order:** `UseCors` → `UseMiddleware<ExceptionHandlingMiddleware>` → `UseResponseCompression` → `UseRateLimiter` → `UseAuthentication` → `UseAuthorization` → `MapControllers`.

---

## Out of Scope (decided, not returning)

- i18n / Hebrew / RTL — English only
- WebSockets / SignalR — 30s polling is sufficient
- Blind level tracking, debt system — removed
- Push notifications — post-MVP
- Offline-first caching — network required
- Payment integration — cash settled offline
