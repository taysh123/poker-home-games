# T Poker

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![.NET 8](https://img.shields.io/badge/.NET-8.0-purple.svg)](https://dotnet.microsoft.com/)
[![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-black.svg)](https://expo.dev/)

A **premium live poker home-game management platform** for private friend groups.
Track buy-ins, cash-outs, settlements, and lifetime statistics — built to feel like
a real modern poker product.

> **Live demo:** _coming soon_ &nbsp;|&nbsp; **iOS/Android:** _EAS build in progress_

---

## Features

### Guest Mode — no account required
- Open the app and run a full poker night **without signing up**: add players,
  track buy-ins/cash-outs, end the game, and get "Alice pays Bob ₪40" cash
  settlements — entirely on-device, no network needed
- Local games persist in device storage (schema-versioned, corruption-quarantined)
- Guest Stats tab: games played, money on the table, biggest win — from local games
- TypeScript port of the backend settlement engine (integer-cents arithmetic,
  unit-tested against shared fixtures)
- Sign in any time to unlock groups, cloud sync, lifetime stats, and leaderboards;
  invite deep links opened while logged out continue automatically after sign-in

### Live Session Management
- Create cash game sessions (standalone or inside a group)
- Real-time buy-in / rebuy / cash-out tracking per player
- Guest player support with optional account linking
- Hand history with pot, winner, and notes
- Live P&L display for every player at the table
- Session notes and CSV export

### Settlement Engine
- Greedy two-pointer debt-minimization algorithm computes explicit payer → receiver transfer pairs
- Handles mixed sessions (registered users + guests): cash remainders after digital settlements are paired separately
- "Cash Settlements" card shows "Alice pays Bob ₪40" with silver accent — no manual calculation needed
- Mark settlements as paid with confirmation
- Cross-session pending settlement dashboard

### Group Management
- Private groups with Owner / Admin / Member roles
- Username-based member invitations with 7-day expiry
- Shareable group invite links (multi-use, 7-day expiry)
- Session invite tokens (single-use, 24h expiry)
- Group activity feed and lifetime leaderboard

### Statistics & Analytics
- Lifetime P&L, win/loss record, win rate
- Per-session history with P&L, duration, and W/L/E result badge
- P&L trend chart (last 10 sessions)
- Group leaderboard with avg P&L and win rate — **period filter** (This Week / This Month / All Time)
- Top-3 leaderboard rows get gold/silver/bronze medal accents
- Current win/loss streak + all-time longest win streak
- **Period filter:** personal stats by This Week / This Month / All Time
- "This week" P&L chip on the home screen hero card
- Per-group P&L shown directly on group list items (home + groups tab)
- Total time played stat reflects the active period filter
- Locked achievement progress shown inline ("7/10 sessions")

### Achievements & Badges
- 14 achievements unlocked automatically when sessions end (First Blood, Hot Streak, High Roller, Comeback Kid, Marathon, and more)
- Rarity tiers: Common, Rare, Epic, Legendary
- Full achievements grid on Stats screen — earned (color) and locked (dimmed) with criteria
- New achievements evaluated on every session end via `AchievementEvaluator`

### In-App Notifications
- Session-end notifications sent to all registered players in the game
- Settlement-paid notifications between payer and receiver
- Group invitation notification sent to invited user
- Notification inbox (bell icon in header) with type icons, unread badge, timeAgo labels
- "Mark all read" action; graceful empty state

### Group Rivalries & Activity
- Tap any group to see the top 5 most-played player pairings — promoted to position 2, above the full member list
- Each rivalry shows sessions together + each player's net P&L across those shared sessions
- Cross-group activity feed on the home screen — date-bucketed into TODAY / THIS WEEK / EARLIER
- Activity icons color-tinted by event type (gold for session start, red for session end, green for joins)
- Pending invitations banner on the home screen when you have outstanding invites

### Session Filtering
- AllSessions tab: filter by group with tappable chips (client-side, instant)

### Onboarding
- First-run 3-slide carousel for new users (skip-able, progress dots)
- Stores completion flag in device storage — never shown again after first launch

### Player Profiles & Rivalries (V2)
- Tap any player in a session or group to view their full career profile
- Career stats: total P&L, biggest win, average session, W/L/E record, streaks
- P&L hero number displayed prominently in the profile header
- Avatar ring: gold border for profitable players, subtle error tint for losing players
- H2H verdict badge: "YOU LEAD" / "THEY LEAD" / "TIED" shown above head-to-head stats
- Recent form dots (last 10 sessions: green/red/gray) with staggered entrance animation
- Head-to-head card: W/L record + net P&L against specific opponents
- Privacy guard: profile only accessible if you share a group with the player

### Session Recaps (V2)
- Post-game recap auto-computed for every finished session
- Collapsible recap card below the results leaderboard
- Shows: duration, total pot, player count, hand count
- Narrative highlights: "Alice was the big winner (+₪340)", "Bob reloaded 3 times", etc.
- Highlights included in the shared PDF when using Share Recap

### Session UX — Premium Atmosphere
- End-game winner row gets gold spotlight: springScale entrance animation + gold background
- Live standings leader chip glows with gold shadow and gold border
- W/L/E result badge on session items across all screens (HomeScreen, StatsScreen)

### Auth & Accounts
- Email/password registration with strong validation
- Google OAuth (native)
- JWT access token (15 min) + refresh token rotation (30 days)
- Remember Me option
- Profile management, password change, account deletion

### Motion & Delight
- Reanimated 4 motion system: springy press-scale on every primary button (with
  haptics), shimmer skeleton loaders, count-up money displays
- Confetti celebration on game end (local summary + winner reveal)
- Frosted-glass tab bar and action sheets on iOS (solid fallback elsewhere)
- Swipeable onboarding carousel with spring-animated pagination dots
- LiveGameBar springs above the tab bar for active games — server **and** local

---

## Screenshots

> Screenshots will be added once the production deployment is live.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile / Web | Expo SDK 54, React Native, TypeScript |
| Navigation | React Navigation v7 (native stack + bottom tabs) |
| Animation | Reanimated 4 + gesture-handler, expo-haptics, expo-blur, expo-linear-gradient |
| Local-first storage | AsyncStorage (guest games, schema-versioned) |
| Testing | Jest (jest-expo) — settlement engine, local game store, money utils |
| HTTP client | Axios with 401 interceptor + auto-refresh |
| Token storage | Platform-aware: `localStorage` (web) / `expo-secure-store` (native) |
| Backend API | ASP.NET Core 8 Web API |
| Architecture | Clean Architecture + CQRS (MediatR) |
| Validation | FluentValidation |
| ORM | Entity Framework Core 8 (Npgsql) |
| Database | PostgreSQL |
| Auth | JWT Bearer + Refresh Token rotation |
| Rate limiting | .NET 8 built-in rate limiter |

---

## Architecture

```
poker-app/
├── apps/poker-mobile/          # Expo React Native app
│   └── src/
│       ├── api/                # Typed Axios wrappers
│       ├── components/         # Reusable UI components
│       │   └── motion/         # PressableScale, Shimmer, AnimatedNumber, GlassView, Celebration
│       ├── context/            # Auth, ActiveSession, LocalGames contexts
│       ├── local/              # Guest-mode engine: settlement port, game store, stats
│       ├── navigation/         # Root stack + authed/guest tab navigators
│       ├── screens/            # One file per screen
│       ├── theme/              # colors.ts, typography.ts, shadows.ts, motion.ts
│       └── utils/              # Formatters, storage, haptics, toast, money (cents)
└── src/
    ├── PokerApp.API/           # Controllers, middleware, DI
    ├── PokerApp.Application/   # Commands, queries, validators, DTOs
    ├── PokerApp.Domain/        # Entities, enums (no framework deps)
    └── PokerApp.Infrastructure/ # EF Core, migrations, configurations
```

**Backend dependency rule:** `Domain ← Application ← Infrastructure ← API`

---

## Setup

### Prerequisites
- .NET 8 SDK
- Node.js 18+
- PostgreSQL (local)
- Expo Go app (for mobile testing)

### 1. Clone & install

```bash
git clone <repo-url>
cd poker-app
cd apps/poker-mobile && npm install
```

### 2. Configure the backend

Create `src/PokerApp.API/appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=poker_app_dev;Username=postgres;Password=yourpassword"
  },
  "JwtSettings": {
    "Secret": "your-256-bit-secret-key-here-minimum-32-chars",
    "Issuer": "TPoker",
    "Audience": "TPokerUsers",
    "AccessTokenExpirationMinutes": 15,
    "RefreshTokenExpirationDays": 30
  },
  "GoogleAuth": {
    "ClientId": "your-google-client-id.apps.googleusercontent.com"
  }
}
```

### 3. Run migrations & start backend

```powershell
cd src/PokerApp.Infrastructure
dotnet ef database update --startup-project ../PokerApp.API

cd ../PokerApp.API
dotnet run --launch-profile http
# → http://localhost:5062
# → Swagger: http://localhost:5062/swagger
```

### 4. Configure the frontend API URL

For mobile testing, update `apps/poker-mobile/src/api/config.ts` with your LAN IP:
```typescript
// or set EXPO_PUBLIC_API_URL in .env
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://YOUR_LAN_IP:5062';
```

### 5. Start the frontend

```powershell
cd apps/poker-mobile
npm run web      # Browser at http://localhost:8081
npm start        # Expo Go — scan QR code with phone
npm run tunnel   # For devices behind firewalls
```

---

## Environment Variables

### Frontend

Copy `apps/poker-mobile/.env.example` → `.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5062` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth Web client (Vercel/web) | Expo proxy |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android client (EAS builds) | Expo proxy |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client (EAS builds) | Expo proxy |

### Backend (appsettings.json / environment variables)

ASP.NET Core maps env vars to config using `__` as the separator:

| Env var | Config key | Description |
|---------|-----------|-------------|
| `ConnectionStrings__DefaultConnection` | `ConnectionStrings:DefaultConnection` | PostgreSQL connection string |
| `JwtSettings__SecretKey` | `JwtSettings:SecretKey` | JWT signing key (min 32 chars) |
| `JwtSettings__Issuer` | `JwtSettings:Issuer` | Token issuer (e.g. "PokerApp") |
| `JwtSettings__Audience` | `JwtSettings:Audience` | Token audience |
| `GoogleSettings__ClientIds__0` | `GoogleSettings:ClientIds[0]` | Google OAuth **web** client ID |
| `AllowedOrigins__0` | `AllowedOrigins[0]` | First allowed CORS origin (Vercel URL) |
| `ASPNETCORE_ENVIRONMENT` | — | Set to `Production` |

### Google OAuth — Production Setup

Google sign-in works out of the box in **Expo Go** (uses the Expo proxy). For
production standalone builds:

**Android**
1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Application type: **Android**
3. Package name: value of `android.package` in `app.json`
4. SHA-1 fingerprint:
   ```bash
   # Debug keystore
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
   # Release keystore — use your own keystore path
   ```
5. Set `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` in your Vercel/EAS environment

**iOS**
1. Create OAuth 2.0 Client ID → Application type: **iOS**
2. Bundle ID: value of `ios.bundleIdentifier` in `app.json`
3. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

If Google sign-in shows "blocked" or "not configured", the SHA-1 or bundle ID
doesn't match the registered client. Email/password auth always works as fallback.

---

## Deployment

### Web Frontend → Vercel

`vercel.json` is already at the repo root. Connect the repo to Vercel and set:
- `EXPO_PUBLIC_API_URL` → your Railway backend URL
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` → your Google Web OAuth client ID

### Mobile → EAS

```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

### Backend → Railway

This repo uses a `Dockerfile` (at the repo root) so Railway always gets a clean, reproducible .NET 8 build — bypassing Nixpacks auto-detection which can misfire on monorepos that contain both `.sln` and `package.json` files.

EF Core migrations run automatically on every startup (`db.Database.Migrate()` in `Program.cs`).

**Step-by-step:**

1. Create a new Railway project → **New Service → GitHub Repo** → select this repo
2. Railway detects the `Dockerfile` automatically — no build command overrides needed
3. Add a **PostgreSQL** plugin in Railway — it injects `DATABASE_URL` automatically
4. Set these **environment variables** in Railway:
   ```
   ASPNETCORE_ENVIRONMENT=Production
   ConnectionStrings__DefaultConnection=<Railway PostgreSQL connection string>
   JwtSettings__SecretKey=<min-64-char random string>
   JwtSettings__Issuer=PokerApp
   JwtSettings__Audience=PokerApp
   JwtSettings__AccessTokenExpirationMinutes=15
   JwtSettings__RefreshTokenExpirationDays=30
   GoogleSettings__ClientIds__0=<your-google-web-client-id.apps.googleusercontent.com>
   AllowedOrigins__0=https://your-app.vercel.app
   AppSettings__WebBaseUrl=https://your-app.vercel.app
   ```
5. Deploy. Railway builds via Docker → migrations run on startup → API is live.

**PostgreSQL connection string format (Railway):**
```
Host=<host>;Port=<port>;Database=<db>;Username=<user>;Password=<password>;SSL Mode=Require;Trust Server Certificate=true
```
Railway shows the exact string under your PostgreSQL plugin → **Connect** tab.

**Generate a JWT secret key:**
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
```

**Health check:** Railway uses `railway.toml` → `healthcheckPath = "/health"`. The endpoint returns `Healthy` when the app is up.

> **Linux/case-sensitivity note:** The Dockerfile resolves a class of CS0246 build errors that occur when Railway's Nixpacks tries to build a monorepo containing both `.sln` and `package.json`. The Dockerfile copies only `src/` and ignores `apps/` entirely, giving the compiler a clean dependency graph.

---

## Security

- Refresh tokens are hashed (SHA-256) in the database — plain tokens never stored
- JWT `ClockSkew = 0` — no tolerance for expired tokens
- Rate limiting on auth endpoints: 10 login / 5 register / 20 refresh per minute per IP
- CORS restricted to configured origins in production (`AllowedOrigins` env var)
- All currency amounts validated: `0 < amount ≤ 1,000,000`
- Role-based access enforced at handler level (not just controller)
- Settlement modifications restricted to payer/receiver only
- `appsettings.Development.json` is gitignored — never committed to source control

---

## Roadmap

| Status | Feature |
|--------|---------|
| ✅ | Full auth (email/password + Google OAuth) |
| ✅ | Group management with roles |
| ✅ | Live session tracking |
| ✅ | Settlement engine |
| ✅ | Hand history |
| ✅ | Statistics & leaderboard |
| ✅ | Session/group invite links |
| ✅ | CSV export + PDF share card |
| ✅ | Player profiles + H2H stats |
| ✅ | Session recaps with narrative highlights |
| ✅ | Streak tracking (current + longest win streak) |
| ✅ | Achievements & badge system (14 achievements) |
| ✅ | Skeleton loading on all screens |
| ✅ | Onboarding first-run carousel |
| ✅ | Response compression (Brotli/gzip) |
| ✅ | Period-based stats (This Week / This Month / All Time) |
| ✅ | In-app notification inbox (session end, settlement paid, group invite) |
| ✅ | Group rivalries (top 5 most-played pairings per group) |
| ✅ | Cross-group activity feed on home screen |
| ✅ | Group leaderboard period filter (week/month/all-time) |
| ✅ | AllSessions group filter chips |
| ✅ | Per-group P&L displayed on all group list items |
| ✅ | Total time played stat (period-aware) |
| ✅ | Production hardening — full middleware pipeline restored (JWT, rate limits, exception handling) |
| ✅ | Cash transfer engine — greedy debt-minimization for guest + mixed sessions |
| ✅ | Social home feed — date-bucketed activity + colored icon tinting |
| ✅ | W/L/E result badges on session list items across all screens |
| ✅ | Group rivalries promoted + leaderboard top-3 medal accents |
| ✅ | Player profile identity: P&L hero, performance avatar ring, H2H verdict badge |
| ✅ | Session winner spotlight (spring animation + gold glow) + live leader chip glow |
| ✅ | Achievement progress text for locked achievements |
| ✅ | **Guest mode** — full local game loop without an account (on-device, offline) |
| ✅ | TypeScript settlement engine port with Jest test suite |
| ✅ | Reanimated 4 motion system (press-scale + haptics, shimmer skeletons, count-ups) |
| ✅ | Confetti celebrations, glass tab bar/sheets (iOS), swipeable onboarding |
| ✅ | Deep-link invite continuation after sign-in (pending-invite handoff) |
| ✅ | Privacy policy page + EAS submit scaffold + store release checklist |
| 🔜 | Import local guest games into a cloud account (`importedSessionId` reserved) |
| 🔜 | Push notifications (Expo push) |
| 🔜 | Native iOS/Android release (EAS — see `docs/store-release.md`) |

---

## Phase History

70 phases shipped from blank canvas to production:

| Phases | Focus |
|--------|-------|
| 1–10 | Project scaffold, auth (JWT + Google OAuth), session CRUD, buy-in/cash-out |
| 11–20 | Group management, roles, invitations, settlements, hand history |
| 21–30 | CSV export, PDF share card, player profiles, H2H stats, session recaps |
| 31–40 | Streak tracking, skeleton loaders, entrance animations, onboarding, achievements |
| 41–50 | Notifications, rivalries, cross-group activity feed, leaderboard periods, per-group P&L |
| 51–60 | Production hardening, Railway deployment fixes, healthcheck, middleware pipeline |
| 61–70 | Cash transfer engine, social home feed, leaderboard medals, profile identity polish, session winner spotlight, achievement progress |
| 71+ | Guest mode (local-first games, no login wall), TS settlement port + Jest, Reanimated 4 motion system, celebrations, glass UI, store-readiness scaffold |

---

## Development

```powershell
# Build checks before committing
dotnet build PokerApp.sln                  # 0 errors required
cd apps/poker-mobile
npx tsc --noEmit                           # 0 errors required
npx jest                                   # settlement engine + local store tests
```
