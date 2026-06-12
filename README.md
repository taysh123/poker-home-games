# T Poker

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![.NET 8](https://img.shields.io/badge/.NET-8.0-purple.svg)](https://dotnet.microsoft.com/)
[![Expo SDK 54](https://img.shields.io/badge/Expo-SDK%2054-black.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](https://www.typescriptlang.org/)

**The private poker club in your pocket.** T Poker runs your home cash game —
buy-ins, rebuys, cash-outs, and the dreaded end-of-night math — and settles
everything down to "Bob pays Alice ₪40". Built for friend groups who play
every week and argue about the ledger every time.

> **Web:** [t-poker.vercel.app](https://t-poker.vercel.app) · **Android:** installable
> v1.1.0 APKs building on EAS ([builds](https://expo.dev/accounts/taysh/projects/t-poker/builds)) ·
> **Store release:** assets + step-by-step guide ready — [docs/store-release.md](docs/store-release.md)

---

## Why T Poker

- **Start playing in 30 seconds, no account.** Guest mode opens to two cards —
  **Cash Game** or **Tournament** — and runs the whole night on-device: name the
  players, track the money, settle up. Nothing leaves your phone.
- **The Final Count.** Ending a game is a guided, foolproof step: enter each
  player's final stack (empty = busted), watch the live balance check
  ("Counted ₪185 of ₪185 on the table ✓"), and get settlements instantly.
- **Minimal payments, exact math.** A greedy debt-minimization engine collapses
  the night's chaos into the fewest possible transfers — identical algorithm on
  the server (C# decimal) and on-device (TypeScript integer cents), pinned by a
  shared test suite.
- **Tournament night, handled.** Local-first tournament mode: fixed entries feed
  a prize pool, a deterministic blind clock (Turbo/Standard/Deep), one-tap
  bust-outs, rebuys, and a medal podium with exact largest-remainder payouts —
  settled into minimal transfers by the same engine as cash games.
- **A club, not a spreadsheet.** Private groups with roles, invite links, a
  tappable activity feed, rivalries, head-to-head records, leaderboards with
  medal accents, 14 achievements, emoji+color player identities, and a weekly
  "Your Week at the Club" digest that gives you a reason to open the app on
  Monday morning.
- **Brag-worthy results.** One tap turns any game's result into a branded podium
  image card for the group chat (plus the existing PDF recap).
- **Your numbers, forever.** Lifetime P&L, win rate, streaks, time played —
  filterable by week/month/all-time, charted, and badged on every session row.
- **Premium dark UI ("Velvet Table").** Deep navy with ambient gradients, serif
  display numerals, gold-gradient CTAs, glass surfaces on iOS, shimmer loading,
  confetti on game end, haptic micro-interactions throughout.

The full shipped-feature ledger lives in [docs/CHANGELOG.md](docs/CHANGELOG.md).

## Screenshots

> Coming with the store listing — run `npm run web` and play a guest game to see
> the product in two minutes.

---

## How it works

### Guest vs. account

| | Guest (no sign-up) | Account |
|---|---|---|
| Run a full game + settlements | ✅ on-device | ✅ cloud |
| Data location | AsyncStorage, never uploaded | PostgreSQL (Railway) |
| Groups, invites, activity feed | — | ✅ |
| Lifetime stats, streaks, achievements | table-level only | ✅ personal |
| Multi-device / multi-player sync | — | ✅ |

The app opens straight into guest mode. Sign-in is offered contextually (Groups
and Stats tabs, cloud-backup banner) and invite deep links opened while logged
out resume automatically after sign-in.

### Sessions

A session is one cash game night. Group sessions live on the server with a
Draft → Active → Finished lifecycle, per-player buy-ins/rebuys/cash-outs, hand
history, and live standings. Guest sessions are the same loop, local-only, and
skip Draft. Ending any session goes through **The Final Count**: final stacks in,
winners/losers/settlements out, with an explicit confirmation that the game is
closing.

### Settlements

Net balance per player = cash-outs − buy-ins. Debtors and creditors are matched
greedily (largest first) so the payment list is minimal. Mixed group sessions
split results into digital settlements (registered/linked players, markable as
paid in-app) and cash pairs for unlinked guests.

### Groups & stats

Groups have Owner/Admin/Member roles, shareable invite links, single-use session
invite tokens, a cross-group activity feed, rivalry pairings, and period-filtered
leaderboards. Personal stats cover lifetime P&L, W/L/E record, win rate, streaks,
biggest win/loss, and time played.

---

## Architecture

```
poker-app/
├── apps/poker-mobile/            # Expo app — iOS, Android, Web from one codebase
│   └── src/
│       ├── api/                  # Typed Axios wrappers + 401 auto-refresh client
│       ├── components/           # UI kit: ScreenHeader, Card, SectionTitle, buttons…
│       │   └── motion/           # Reanimated 4: PressableScale, Shimmer, Celebration…
│       ├── context/              # Auth, ActiveSession, LocalGames
│       ├── local/                # Guest engine: settlement port, game store, stats
│       ├── navigation/           # Guest tree + authed tree (no login wall)
│       ├── screens/              # One file per screen
│       ├── theme/                # Tokens: colors, typography, spacing, radii, shadows
│       └── utils/                # money (integer cents), haptics, storage, confirm…
└── src/                          # ASP.NET Core 8 backend — Clean Architecture
    ├── PokerApp.API/             # Controllers, middleware, rate limiting, JWT
    ├── PokerApp.Application/     # CQRS (MediatR) commands/queries + FluentValidation
    ├── PokerApp.Domain/          # Entities & enums, zero framework dependencies
    └── PokerApp.Infrastructure/  # EF Core (Npgsql), migrations, identity services
```

- **Backend dependency rule:** `Domain ← Application ← Infrastructure ← API`.
- **Auth:** 15-min JWT access tokens + 30-day rotating refresh tokens (hashed
  at rest, reuse detection). The mobile client refreshes transparently via a
  single-flight Axios interceptor.
- **Local-first guest engine:** `src/local/settlements.ts` mirrors the backend
  `SettlementCalculatorService.cs` exactly; both implementations are pinned by
  shared fixtures (Jest). Local games are schema-versioned in AsyncStorage with
  corruption quarantine — bad payloads are preserved, never wiped.

| Layer | Technology |
|-------|-----------|
| Mobile / Web | Expo SDK 54, React Native 0.81, React 19, TypeScript strict |
| Motion | Reanimated 4, gesture-handler, expo-haptics, expo-blur, expo-linear-gradient |
| Typography | System sans + DM Serif Display accents (expo-google-fonts) |
| Backend | ASP.NET Core 8, MediatR CQRS, FluentValidation, EF Core 8, PostgreSQL |
| Auth | JWT + refresh rotation, Google OAuth, BCrypt |
| Notifications | In-app inbox + Expo push (native; device tokens, best-effort delivery) |
| Testing | Jest (settlement engine, local store, money utils) |

---

## Quickstart

**Prerequisites:** .NET 8 SDK · Node 18+ · PostgreSQL · (optional) Expo Go on your phone

```powershell
git clone https://github.com/taysh123/poker-home-games.git
cd poker-app/apps/poker-mobile && npm install
```

**Backend** — create `src/PokerApp.API/appsettings.Development.json`:

```json
{
  "ConnectionStrings": { "DefaultConnection": "Host=localhost;Port=5432;Database=poker_app_dev;Username=postgres;Password=yourpassword" },
  "JwtSettings": { "SecretKey": "a-random-secret-of-at-least-32-characters", "Issuer": "PokerApp", "Audience": "PokerApp", "AccessTokenExpirationMinutes": 15, "RefreshTokenExpirationDays": 30 },
  "GoogleSettings": { "ClientIds": ["your-google-web-client-id.apps.googleusercontent.com"] }
}
```

```powershell
cd src/PokerApp.Infrastructure
dotnet ef database update --startup-project ../PokerApp.API
cd ../PokerApp.API
dotnet run --launch-profile http        # API → http://localhost:5062 (Swagger at /swagger)
```

**Frontend:**

```powershell
cd apps/poker-mobile
npm run web      # browser at http://localhost:8081
npm start        # Expo Go — scan the QR code
```

Guest mode works with no backend running — that's the point.

### Verify a change

```powershell
cd apps/poker-mobile
npx tsc --noEmit     # must pass before committing
npx jest             # settlement engine + local store + money utils
cd ../.. ; dotnet build PokerApp.sln
```

---

## Environment variables

**Frontend** — copy `apps/poker-mobile/.env.example` → `.env`:

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | Backend base URL (defaults to localhost on web, LAN IP on device) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth — web builds |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth — Android store builds |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth — iOS store builds |

Google sign-in requires the OAuth client IDs to be allow-listed on the backend and
the web origin registered in Google Cloud Console — full setup/troubleshooting:
[docs/google-oauth-fix.md](docs/google-oauth-fix.md).

**Backend** (env vars map to config with `__`):

| Variable | Purpose |
|----------|---------|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string |
| `JwtSettings__SecretKey` / `__Issuer` / `__Audience` | Token signing |
| `GoogleSettings__ClientIds__0` | Google OAuth web client |
| `AllowedOrigins__0` | CORS origin (your web URL) |
| `AppSettings__WebBaseUrl` | Base URL used in invite links |
| `ASPNETCORE_ENVIRONMENT` | `Production` in deployment |

---

## Deployment

| Target | How |
|--------|-----|
| **Backend → Railway** | Root `Dockerfile`; EF migrations run on startup; health check at `/health` via `railway.toml`. Set the backend env vars above. |
| **Web → Vercel** | Repo-connected; `vercel.json` at root. Set `EXPO_PUBLIC_API_URL` + Google web client ID. Privacy policy ships at `/privacy.html`. |
| **iOS / Android → EAS** | `eas build --profile production --platform all`, then `eas submit`. Full checklist incl. credentials you must supply: [docs/store-release.md](docs/store-release.md). |

Security posture: hashed refresh tokens, zero JWT clock skew, per-IP rate limits
on auth endpoints, CORS allow-list in production, role checks at handler level,
amount validation on every transaction. Privacy policy: [PRIVACY.md](PRIVACY.md).

---

## Roadmap

Full prioritized roadmap with efforts and release trains: [docs/roadmap-v2.md](docs/roadmap-v2.md).
Headline next steps: server-side group tournaments → push delivery rollout →
Play Store internal track → local-to-cloud game import.

## License

MIT — see [LICENSE](LICENSE).
