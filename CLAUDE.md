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

## Active Session Context

`ActiveSessionContext` drives the `LiveGameBar` (floats above tab bar when a game is in progress). It:
- Polls `GET /api/auth/stats` every **30 seconds**
- Refreshes on every `AppState → active` event (app foregrounded)
- Finds the first session with `status === 'Active'` from recent sessions

Call `refresh()` after starting/ending a session to update the bar immediately. Call `clear()` when navigating away from a finished session.

---

## Auth

JWT: 15-min access token + 30-day refresh token (stored hashed SHA-256 in DB, never plain).

`AuthContext` lifecycle:
1. Startup: reads `user` from storage (SecureStore native, localStorage/sessionStorage web)
2. Login: calls API → `saveSession()` sets state first (drives navigation), then persists async
3. 401 on any request: `apiClient` interceptor attempts refresh; on failure calls `onUnauthenticated` → `clearSession()` → `setUser(null)`
4. "Remember me = false" uses `sessionStorage` on web (session mode via `storage.setSessionMode(true)`)

`AppNavigator` renders auth screens when `user === null`, app screens otherwise — no manual `navigation.replace()` needed.

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

Copy `.env.example` → `.env`. Expo Go in development uses the hardcoded Expo proxy client — no env vars needed.

### Backend (`src/PokerApp.API/appsettings.Development.json` — gitignored)

```json
{
  "ConnectionStrings": { "DefaultConnection": "Host=localhost;Database=poker_app_dev;..." },
  "JwtSettings": { "Secret": "...", "Issuer": "TPoker", "Audience": "TPokerUsers" },
  "GoogleAuth": { "ClientId": "your-google-web-client-id.apps.googleusercontent.com" }
}
```

---

## Deployment

### Web → Vercel

```json
{
  "buildCommand": "cd apps/poker-mobile && npx expo export -p web",
  "outputDirectory": "apps/poker-mobile/dist",
  "framework": null
}
```
Set `EXPO_PUBLIC_API_URL` in Vercel environment settings.

### Mobile → EAS
```powershell
npx eas build --platform ios
npx eas build --platform android
```

### Backend
Set `AllowedOrigins` in `appsettings.Production.json` before deploying.

---

## Out of Scope (decided, not returning)

- i18n / Hebrew / RTL — English only
- WebSockets / SignalR — 30s polling is sufficient
- Blind level tracking, debt system — removed
- Push notifications — post-MVP
- Offline-first caching — network required
- Payment integration — cash settled offline
