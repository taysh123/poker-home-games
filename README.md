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

### Live Session Management
- Create cash game sessions (standalone or inside a group)
- Real-time buy-in / rebuy / cash-out tracking per player
- Guest player support with optional account linking
- Hand history with pot, winner, and notes
- Live P&L display for every player at the table
- Session notes and CSV export

### Settlement Engine
- Greedy two-pointer algorithm minimizes the number of payments
- "Who pays whom" — clear settlement chains
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
- Per-session history with P&L and duration
- P&L trend chart (last 10 sessions)
- Group leaderboard with avg P&L and win rate

### Auth & Accounts
- Email/password registration with strong validation
- Google OAuth (native)
- JWT access token (15 min) + refresh token rotation (30 days)
- Remember Me option
- Profile management, password change, account deletion

---

## Screenshots

> Screenshots will be added once the production deployment is live.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile / Web | Expo SDK 54, React Native, TypeScript |
| Navigation | React Navigation v7 (native stack + bottom tabs) |
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
│       ├── context/            # Auth, ActiveSession contexts
│       ├── navigation/         # Stack + tab navigator
│       ├── screens/            # One file per screen
│       ├── theme/              # colors.ts, typography.ts
│       └── utils/              # Formatters, storage, haptics, toast
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
| ✅ | CSV export |
| 🔜 | Tournament mode |
| 🔜 | Push notifications |
| 🔜 | Native iOS/Android release (EAS) |

---

## Development

```powershell
# Build checks before committing
dotnet build PokerApp.sln              # 0 errors required
cd apps/poker-mobile && npx tsc --noEmit   # 0 errors required
```
