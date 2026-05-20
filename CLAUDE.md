# T Poker — Project Guide

## Product Vision

T Poker is a **premium live poker home-game management platform**. It lets private
friend groups run cash game sessions with full tracking of buy-ins, cash-outs,
settlements, and lifetime statistics — feeling like a real modern poker product,
not a student prototype.

**Inspired by:** PokerStars / modern premium mobile poker apps  
**Target users:** Regular home-game groups who play weekly  
**Core differentiation:** Premium UX during live games — minimal taps, instant actions,
multiplayer-aware design that works when six people are arguing over who owes what

---

## Engineering Philosophy

Act like a **senior engineer building a startup MVP**.

Prioritize:
- **Scalability** — Clean Architecture, CQRS, no coupled layers
- **Maintainability** — Clear naming, small focused files, shared utilities
- **Production readiness** — Proper error handling, loading states, auth guards
- **Strong TypeScript** — Typed API responses, typed navigation params, no `any`
- **Secure patterns** — JWT best practices, hashed tokens, role-based access
- **Smooth UX** — Optimistic updates where safe, haptic feedback, toast notifications

Do not: add features beyond what's asked, create unnecessary abstractions,
write defensive code for impossible cases, or leave TODO comments.

---

## UX Philosophy

The app must feel **premium and responsive during a live poker game**.

Always optimize for:
- **Minimal taps** — critical actions (buy-in, cash-out) reachable in 2 taps
- **Fast player actions** — no loading spinners on local state changes
- **Readable layouts** — large numbers, color-coded P&L, clear hierarchy
- **Touch-friendly controls** — 48px+ tap targets, generous padding
- **Mobile-first interactions** — thumb-reachable action bars, bottom sheets

Never block the UI for non-critical operations. Error states should degrade
gracefully. The live session screen is the core experience — it must be flawless.

---

## Design System

**Style direction:** Dark luxury, PokerStars-inspired

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0F1923` | Screen backgrounds (deep navy) |
| `surface` | `#1A2535` | Cards, inputs, containers |
| `surfaceHigh` | `#1E2D3D` | Elevated surfaces, focused inputs |
| `border` | `#243447` | Card borders, dividers |
| `gold` | `#C9A84C` | Primary accent — buttons, active states, key numbers |
| `goldLight` | `#E8C97A` | Positive P&L, highlighted amounts |
| `text` | `#FFFFFF` | Primary text |
| `textMuted` | `#7A8A99` | Labels, secondary text |
| `textDim` | `#3A4A5A` | Placeholders, disabled |
| `error` | `#E74C3C` | Negative P&L, errors |
| `success` | `#27AE60` | Positive outcomes, wins |

**Typography:** See `apps/poker-mobile/src/theme/typography.ts` — do not hardcode font sizes.  
**Icons:** Ionicons via `@expo/vector-icons`  
**Animations:** `Animated` from React Native, `useNativeDriver: true` always

Gold accents are used **sparingly** — only on primary CTAs, live indicators, and
key financial numbers. Overusing gold degrades the premium feel.

---

## Required Thinking

Before implementing any feature, consider:

- **Edge cases** — empty data, zero amounts, single player, deleted accounts
- **Auth persistence** — what happens if token expires mid-action?
- **Reload persistence** — does state survive app background/foreground?
- **Broken navigation** — can every screen be reached and exited without getting stuck?
- **Multiplayer sync** — two admins acting simultaneously on a session
- **Real-world mistakes** — wrong buy-in amount, adding wrong player
- **Accessibility** — minimum 48px touch targets, sufficient color contrast
- **Responsive behavior** — does the layout work on small phones (iPhone SE)?
- **Performance** — FlatList for long lists, no blocking renders
- **Vercel deployment** — web bundle must build; no native-only APIs without platform guards

---

## Technical Expectations

- JWT with 15-min access token + 30-day refresh token rotation
- Refresh tokens hashed (SHA-256) — never stored plain
- All API calls read token from storage before each request (no context passing)
- Rate limiting on auth endpoints (10/5/20 req/min per IP)
- FluentValidation on all commands — validators throw before handlers run
- `useFocusEffect` for data refresh on navigation return
- `useCallback` + proper deps arrays — no stale closures
- Every screen has: loading state, error state with retry, empty state with CTA
- Haptic feedback on critical actions (successNotification, errorNotification)
- Toast notifications for async results (never Alert for non-destructive feedback)
- No `console.log` left in production code

---

## Monorepo Structure

```
poker-app/
├── apps/
│   └── poker-mobile/            # Expo SDK 54 — iOS, Android, Web
│       ├── src/
│       │   ├── api/             # Typed Axios wrappers (one file per resource)
│       │   ├── components/      # Shared UI: PrimaryButton, AppTextInput, Badge, Toast...
│       │   ├── context/         # AuthContext, ActiveSessionContext
│       │   ├── hooks/           # useGoogleAuth
│       │   ├── navigation/      # AppNavigator (stack + bottom tabs)
│       │   ├── screens/         # One file per screen
│       │   ├── theme/           # colors.ts, typography.ts
│       │   └── utils/           # formatters, storage, haptics, toast, parseAuthError
│       └── assets/              # icon.png, splash-icon.png, adaptive-icon.png
├── src/
│   ├── PokerApp.API/            # ASP.NET Core 8 Web API
│   ├── PokerApp.Application/    # CQRS: commands, queries, validators, DTOs
│   ├── PokerApp.Domain/         # Entities, enums — no framework deps
│   └── PokerApp.Infrastructure/ # EF Core, migrations, configs
├── PokerApp.sln
└── CLAUDE.md
```

---

## Backend Architecture

### Dependency Chain (strict — no violations)
```
Domain  ←  Application  ←  Infrastructure
                ↑
               API
```

- **Domain**: Pure C# — entities, enums, value objects. No EF, no MediatR.
- **Application**: Business logic. Commands, queries, validators. Depends only on Domain + interfaces.
- **Infrastructure**: EF Core implementation, migrations, repositories.
- **API**: Controllers (thin), middleware, DI wiring. Calls MediatR only.

### Pattern: CQRS with MediatR
Every operation is a `Command` (mutating) or `Query` (read-only).
Each has: `*Command.cs` / `*Query.cs` + `*Handler.cs` + `*Validator.cs` (commands only).
Handlers are discovered by convention — register nothing manually.

### Auth Flow
```
POST /api/auth/login
  → validate credentials → generate JWT (15 min) + refresh token (30 days, hashed in DB)
  → return { accessToken, refreshToken, userId, username, email }

POST /api/auth/refresh
  → validate refresh token hash → rotate: revoke old, issue new pair
  → return { accessToken, refreshToken }

401 on any request
  → frontend apiClient interceptor attempts refresh
  → on refresh failure: clearSession() → setUser(null) → Login screen
```

### Role System
- `AppRole`: Regular / Admin — user-level, currently unused for special powers
- `GroupRole`: Member / Admin / Owner — group-level, enforced in all handlers

---

## Frontend Architecture

### Navigation Structure
```
AppNavigator
├── Auth stack (user === null)
│   ├── Login
│   └── Register
└── App stack (user !== null)
    ├── MainTabs (bottom tab navigator)
    │   ├── Home
    │   ├── AllSessions
    │   ├── GroupsList
    │   └── Stats
    └── Deep screens (push above tabs, tab bar hides)
        ├── GroupDetail, EditGroup (modal), SessionsList
        ├── Session, NewGame, CreateGroup (modal)
        ├── Profile, Invitations, PendingSettlements
        └── JoinSession, JoinGroup (deep link entry points)
```

`LiveGameBar` floats above the tab bar when an active session exists (provided by `ActiveSessionContext`).

### Data Fetching Pattern
```typescript
// Every screen owns its own fetch:
const load = useCallback(async () => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (!token) return;
  const data = await someApi(token, ...args);
  setState(data);
}, [deps]);

useFocusEffect(useCallback(() => { load(); }, [load]));
```

### Key Utilities
| File | Purpose |
|------|---------|
| `utils/storage.ts` | Platform-aware token storage (localStorage web, SecureStore native) |
| `utils/formatters.ts` | Shared: formatPL, formatMoney, formatDate, formatDuration |
| `utils/haptics.ts` | Haptic feedback (native only, web-safe) |
| `utils/toast.ts` | Global toast pub/sub |
| `utils/parseAuthError.ts` | Converts axios errors → user-friendly messages |
| `api/apiClient.ts` | Axios instance with 401 refresh interceptor |

---

## How to Run

### Backend
```powershell
cd src/PokerApp.API
dotnet run --launch-profile http
# API: http://0.0.0.0:5062
# Swagger: http://localhost:5062/swagger
```

### Frontend
```powershell
cd apps/poker-mobile
npm start          # Expo Go on phone (scan QR code)
npm run web        # Browser at http://localhost:8081
npm run tunnel     # ngrok tunnel for physical devices
```

### Prerequisites
- .NET 8 SDK
- Node.js 18+
- PostgreSQL running locally — database: `poker_app_dev`
- Expo Go app for mobile testing

---

## Environment Variables

### Frontend (`apps/poker-mobile/.env` — gitignored)
```
EXPO_PUBLIC_API_URL=https://api.yourapp.com
```
Falls back to `http://localhost:5062` (web) or LAN IP (native) if not set.

### Backend (`src/PokerApp.API/appsettings.Development.json` — gitignored)
```json
{
  "ConnectionStrings": { "DefaultConnection": "Host=localhost;Database=poker_app_dev;..." },
  "JwtSettings": { "Secret": "...", "Issuer": "TPoker", "Audience": "TPokerUsers" }
}
```

---

## Deployment

### Web Frontend → Vercel
```json
// vercel.json
{
  "buildCommand": "cd apps/poker-mobile && npx expo export -p web",
  "outputDirectory": "apps/poker-mobile/dist",
  "framework": null
}
```
Set `EXPO_PUBLIC_API_URL` in Vercel environment settings.

### Mobile → EAS Build
```powershell
npx eas build --platform ios
npx eas build --platform android
```

### Backend → Any hosting (Railway, Azure, Fly.io)
Set `AllowedOrigins` in `appsettings.Production.json` before deploying.
Use environment variables for all secrets — never commit production values.

---

## Build Checks

After any change:
```powershell
# Backend (from repo root)
dotnet build PokerApp.sln

# Frontend (from apps/poker-mobile)
npx tsc --noEmit
```

Both must pass with 0 errors before committing.

---

## What NOT to Build (decided)

- ~~i18n / Hebrew / RTL~~ — English only
- ~~WebSockets / SignalR~~ — 30s polling is sufficient
- ~~Blind level tracking~~ — removed, not returning
- ~~Debt system~~ — removed, not returning
- ~~Push notifications~~ — post-MVP
- ~~Offline-first caching~~ — network required; acceptable
- ~~Payment integration~~ — settlements tracked digitally, cash settled offline
