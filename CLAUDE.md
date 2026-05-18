# PokerHome — Project Architecture Guide

## What This Is

PokerHome is a private poker home games management platform. It lets friend groups run
cash game sessions: tracking buy-ins, cash-outs, settlements, and lifetime statistics.

---

## Monorepo Structure

```
poker-app/
├── apps/
│   └── poker-mobile/        # Expo React Native app (iOS, Android, Web)
├── src/
│   ├── PokerApp.API/        # ASP.NET Core Web API
│   ├── PokerApp.Application/ # CQRS handlers, validators, DTOs
│   ├── PokerApp.Domain/     # Entities, enums, domain logic
│   └── PokerApp.Infrastructure/ # EF Core, migrations, repositories
├── PokerApp.sln             # .NET solution file
└── CLAUDE.md                # This file
```

---

## How to Run

### Backend
```powershell
cd src/PokerApp.API
dotnet run --launch-profile http
# Listens on http://0.0.0.0:5062
# Swagger: http://localhost:5062/swagger
```

### Frontend
```powershell
cd apps/poker-mobile
npm start          # Expo Go (mobile, QR code)
npm run web        # Browser at http://localhost:8081
npm run tunnel     # Tunnel mode for physical devices behind firewalls
```

### Prerequisites
- .NET 8 SDK
- Node.js 18+
- PostgreSQL running locally
  - Dev database: `poker_app_dev` (see `appsettings.Development.json`)
- Expo Go app on your phone (for mobile testing)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Mobile/Web frontend | Expo SDK 54, React Native, TypeScript |
| HTTP client | Axios |
| Navigation | React Navigation v7 (native stack) |
| Token storage | Platform-aware wrapper (localStorage on web, SecureStore on native) |
| Backend API | ASP.NET Core 8 Web API |
| Architecture | Clean Architecture + CQRS (MediatR) |
| ORM | Entity Framework Core 8 (Npgsql) |
| Database | PostgreSQL |
| Auth | JWT Bearer + Refresh Token rotation |

---

## Key Architectural Decisions

### Backend — Clean Architecture
The backend is split into four projects that form a strict dependency chain:

```
Domain  ←  Application  ←  Infrastructure
                ↑
               API
```

- **Domain**: Pure C# — no framework dependencies. Entities and enums only.
- **Application**: Business logic. Commands, queries, validators, DTOs. Depends only on Domain.
- **Infrastructure**: EF Core, database, external services. Implements Application interfaces.
- **API**: HTTP layer — controllers, middleware, DI wiring. Depends on Application + Infrastructure.

### Frontend — Feature screens with shared API layer
Each screen is responsible for its own data fetching and state. Shared behaviour lives in:
- `src/context/AuthContext.tsx` — JWT session, login/logout/register
- `src/utils/storage.ts` — token persistence (localStorage on web, SecureStore on native)
- `src/api/*.ts` — typed Axios wrappers for each backend resource

### Auth Flow
```
Login/Register → AuthContext.login/register()
  → authApi → POST /api/auth/login (or /register)
  → backend validates → returns { accessToken, refreshToken, user }
  → saveSession(): setUser() immediately (drives navigation), then persist to storage
  → AppNavigator: user !== null → show app screens
```

Tokens are stored in `localStorage` on web and `expo-secure-store` on native.
All authenticated API calls read the token from storage before each request.

---

## Phase Roadmap

| Phase | Goal |
|-------|------|
| 1 ✅ | Stabilize auth, storage, navigation |
| 2 | Complete Groups system |
| 3 | Live cash session management |
| 4 | Settlement engine UI |
| 5 | Saved games + statistics |
| 6 | Session notes and hand history |
| 7 | Manual entries + debt tracking |
| 8 | Production hardening |

---

## Environment Notes

- **API URL (web)**: `http://localhost:5062`
- **API URL (mobile)**: `http://<LAN-IP>:5062` — update `src/api/config.ts` when your IP changes
- **CORS**: Open (`AllowAnyOrigin`) for development — restrict before production
- **JWT secret**: Set in `appsettings.Development.json` — never commit production secrets
