# T Poker

A **premium live poker home-game management platform** for private friend groups.
Track buy-ins, cash-outs, settlements, and lifetime statistics — built to feel like
a real modern poker product.

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

> _Coming soon — app is in active development_

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

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `http://localhost:5062` |

### Backend (appsettings.json)

| Key | Description |
|-----|-------------|
| `ConnectionStrings:DefaultConnection` | PostgreSQL connection string |
| `JwtSettings:Secret` | JWT signing key (min 32 chars) |
| `JwtSettings:Issuer` | Token issuer (e.g. "TPoker") |
| `JwtSettings:Audience` | Token audience |
| `GoogleAuth:ClientId` | Google OAuth client ID |
| `AllowedOrigins` | Comma-separated list (production CORS) |

---

## Deployment

### Web Frontend → Vercel

Add `vercel.json` to repo root:
```json
{
  "buildCommand": "cd apps/poker-mobile && npx expo export -p web",
  "outputDirectory": "apps/poker-mobile/dist",
  "framework": null
}
```

Set `EXPO_PUBLIC_API_URL` in Vercel project environment variables.

### Mobile → EAS

```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

### Backend → Railway / Azure / Fly.io

1. Set all `JwtSettings` and `ConnectionStrings` as environment variables
2. Set `AllowedOrigins` to your Vercel URL in production config
3. Run `dotnet ef database update` against production DB on first deploy

---

## Security

- Refresh tokens are hashed (SHA-256) in the database — plain tokens never stored
- JWT `ClockSkew = 0` — no tolerance for expired tokens
- Rate limiting on auth endpoints: 10 login / 5 register / 20 refresh per minute per IP
- CORS restricted to configured origins in production
- All currency amounts validated: `0 < amount ≤ 1,000,000`
- Role-based access enforced at handler level (not just controller)
- Settlement modifications restricted to payer/receiver only

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
