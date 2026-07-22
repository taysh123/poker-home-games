# Backend Architecture — PokerApp

> Rewritten 2026-07-22 against the Phase-1 audit (the previous version predated Billing, Coach,
> Sync, Entitlements, Notifications, and the Phase-46 pipeline). Patterns-first — the folder
> tree is the inventory.

## Solution Structure

```
src/
├── PokerApp.API/            # HTTP layer: controllers, middleware, DI, Program.cs
├── PokerApp.Application/    # Business logic: commands, queries, validators, DTOs
├── PokerApp.Domain/         # Core domain: entities, enums (no framework dependencies)
├── PokerApp.Infrastructure/ # EF Core (Persistence/), services, billing, identity, settings
└── PokerApp.Tests/          # xUnit — security/billing/coach/sync seams (~230 tests)
```

Dependency direction (inner never depends on outer): `Domain ← Application ← Infrastructure`, API on top.

## Application layer — CQRS via MediatR

`Application/Features/` has TEN areas: **Auth** (login/register/refresh/Google/Apple/profile/
delete-account), **Billing** (validate-purchase, webhooks, checkout remnants), **Coach**
(AnalyzeHand + credits), **Entitlements**, **Groups**, **Notifications**, **Sessions**,
**Settlements**, **Sync**, **Users** (stats, achievements, profile, search, weekly digest).

Each command/query: `*Command.cs` (record `IRequest<T>`) + handler + FluentValidation validator
(commands only) + response/DTO. MediatR + FluentValidation scan by assembly — register nothing
manually. Controllers stay thin: claims → command → `mediator.Send()` → status code.
`ExceptionHandlingMiddleware` maps NotFound→404, BadRequest→400, Validation→400+fields,
Conflict→409, Unauthorized→401, UnauthorizedAccess→403.

## Domain — key entities beyond the game core

Game core: User, Group, GroupMember, GroupInvitation, GroupInviteLink, Session, SessionPlayer,
SessionInviteToken, BuyIn, CashOut, Settlement, HandRecord, RefreshToken.
Platform: Notification, DeviceToken, Achievement (+UserAchievement, seeded catalog),
Subscription, StoreWebhookEvent, CreditBalance, CreditLedgerEntry, CloudBackup.

## Infrastructure

- **EF Core:** `Persistence/` — AppDbContext, per-entity Configurations, and **Migrations under
  `Persistence/Migrations/`** (26+; startup applies them via a fire-and-forget task after
  ApplicationStarted — a failed migration logs but does not stop traffic).
- **Services** (~22): AchievementEvaluator (post-EndSession), NotificationService (+ExpoPushService,
  best-effort inside try/catch), EntitlementService (fail-closed; sandbox subs excluded unless
  `AcceptSandbox` — default FALSE), CreditLedger (atomic reserve/refund, content-bound idempotency),
  CoachAiProviderFactory (mock default; `anthropic` only via server config), GoogleAuthService /
  AppleAuthService (JWKS + audience + nonce, fail-closed), FraudEvaluator, AuditLog (ILogger only).

## Billing — FAIL-CLOSED in production (PR #24)

`BillingVerifierSelection.Resolve(provider, isProduction)` (pure, test-pinned): in Production any
non-`"direct"` provider ⇒ `DisabledBillingVerifier` (verifies nothing → validate returns 400).
The mock verifier (grants premium for ANY receipt) is a dev/test-only seam. `AcceptSandbox`
defaults false in code; `appsettings.Production.json` pins `direct` + `AcceptSandbox=false`
(pinned by `BillingFailClosedProdTests`). App-store billing later plugs into `IBillingVerifier`
(Apple JWS / Google OIDC verifiers exist, credential-gated).

## AI Coach — dormant by four layers

Client `coach` flag OFF → server provider default `"mock"` (deterministic, zero API calls) →
null `CoachAiSettings:ApiKey` throws fail-closed (credit refunded) → `[Authorize]` everywhere.
AnalyzeHand: entitlement → fraud score → atomic credit reserve → provider → refund-on-throw;
SHA-256 content-bound idempotency key. Server persists NO analysis content (credits ledger only).

## Cloud Sync — live but dark

`CloudBackup` (one row per user+namespace, opaque payload ≤1MB, app-level Version concurrency);
`GET/PUT /api/sync/{ns}`; allow-list {localGames, study, coach} in `SyncContract`, whose
`EnsurePremiumAsync` currently 403s ALL free users (per-namespace free policy is master-plan 3.2,
with an owner-approved S7a test re-scope).

## Program.cs pipeline (Phase 46 — ORDER MATTERS)

`/health` → Swagger(dev) → **UseForwardedHeaders (prod only, ForwardLimit=1)** →
SecurityHeadersMiddleware → **UseCors** → ExceptionHandlingMiddleware → UseResponseCompression →
**UseAuthentication** → **UseRateLimiter** → UseAuthorization → MapControllers.
CORS precedes the exception middleware (headers on error responses); Authentication precedes the
rate limiter so `coach-analyze` partitions per user; ForwardedHeaders de-proxies the client IP so
auth limiters partition per real IP behind Railway (requires `ASPNETCORE_ENVIRONMENT=Production`).
Partition keys are pure in `PokerApp.Application.Common.RateLimitKeys`. JWT: 15-min access +
30-day rotating refresh (SHA-256-hashed at rest); `JwtKey.ResolveSigningKey` fails closed outside
Development on a missing/short secret. Config key is `JwtSettings:SecretKey`.

## Auth flow notes

- Google + Apple sign-in validate identity tokens server-side (JWKS, issuer, audience allow-lists
  `GoogleSettings:ClientIds` / `AppleSettings:ClientIds`, optional nonce — Apple compares the
  token's nonce claim VERBATIM to the supplied value; the iOS client sends one random UUID per
  attempt).
- Open email registration is OFF (`AuthSettings.AllowEmailRegistration=false`) — verified
  providers only; existing email accounts keep working.

## Testing & dev

- `dotnet test PokerApp.sln` — suites concentrate on the security/billing/coach/sync seams.
  KNOWN GAP: Sessions/Groups/Settlements handlers have no backend unit tests; the settlement
  algorithm is pinned by the TS port's fixtures (`apps/poker-mobile/src/local/__tests__/`).
- Run API: `dotnet run --launch-profile http` from `src/PokerApp.API` (Swagger at :5062).
- Migrations: `dotnet ef migrations add X --startup-project ../PokerApp.API` from
  `src/PokerApp.Infrastructure` (files land in `Persistence/Migrations/`).
- Never commit build output (`out*/` is gitignored — `out2/` was 51 committed DLLs until 0.5).
