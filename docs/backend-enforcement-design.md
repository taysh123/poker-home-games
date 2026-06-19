# T Poker — Backend Enforcement Design (monetization safety)

_Status: **DESIGN ONLY** — no billing implemented. This is the authoritative system that must
exist before charging real money. Until it ships, the V2 paywall + AI credit limits are
**client-side UX only** (bypassable) and real billing stays OFF._

## 0. Purpose & principles

Make monetization **safe and abuse-proof** by moving the source of truth for entitlements and AI
credits from the device to the server. Principles:

- **The client is untrusted.** It never decides what a user is entitled to or how many credits
  remain. It displays a server-provided cache and calls server endpoints that enforce.
- **Fail closed.** If entitlement/credit cannot be verified, deny the costly action.
- **Receipts are validated with the stores**, never trusted from the client.
- **Every costly action (AI) goes through the server**, which holds the vendor key, reserves a
  credit atomically, then calls the model.
- **Mostly-unchanged client.** Reuse the existing seams (`IBillingProvider`, `EntitlementsContext`,
  `ICoachProvider`) so the app swaps providers, not screens.

Backend conventions to follow (existing): .NET 8 Clean Architecture + MediatR CQRS
(`Domain/Application/Infrastructure/API`), EF Core + PostgreSQL, JWT (`JwtService`, 15-min access +
rotating refresh), provider-token validation pattern (`GoogleAuthService` + `GoogleSettings:ClientIds`),
`ExceptionHandlingMiddleware`, `UseRateLimiter`. Apple mirrors Google.

---

## 1. Architecture proposal

```
 Mobile app (untrusted)                      Stores
 ├─ Purchase UX via IBillingProvider  ──►  Apple App Store / Google Play
 │    (StoreKit / Play Billing / RevenueCat)        │  (purchase, receipts)
 ├─ EntitlementsContext  ◄── GET /entitlements      │  server notifications (renew/cancel/refund)
 ├─ Coach credit counter ◄── GET /coach/credits     ▼
 └─ ICoachProvider ─ POST /coach/analyze ─►  ┌──────────────────────────────┐
                                            │  T Poker API (.NET 8, trusted) │
   POST /auth/{google|apple}  ─────────────►│  • Auth: validate ID token→JWT │
   POST /webhooks/{apple|google} ◄──store──►│  • Billing verifier (receipts) │
                                            │  • Entitlement service          │
                                            │  • AI credit ledger (atomic)    │
                                            │  • AI proxy (vendor key)        │
                                            └───────────────┬──────────────┘
                                                            ▼  PostgreSQL (source of truth)
```

**Billing verification: aggregator-first, vendor-agnostic.** Introduce a server-side
`IBillingVerifier` with two interchangeable implementations:
- **RevenueCat (recommended first):** offloads receipt validation + store notifications + the
  Apple/Google API plumbing; server consumes RevenueCat REST + webhooks. Fastest safe path.
- **Direct-to-store (fallback / later):** Apple App Store Server API v2 + App Store Server
  Notifications V2 (JWS), Google Play Developer API + Real-Time Developer Notifications (RTDN via
  Pub/Sub). More control, more maintenance.

The rest of the system (entitlements, ledger, AI proxy) is identical regardless of verifier —
the seam keeps us un-coupled (mirrors the client's `IBillingProvider`).

**AI proxy.** Today the client calls the model provider directly (mock). For paid launch the model
call MUST run on the server (`POST /coach/analyze`): the server authenticates the user, reserves a
credit atomically, calls the AI vendor with a server-held key, then commits/refunds. Vendor stays
swappable behind the existing `ICoachProvider` contract (server-side mirror).

---

## 2. Data model (EF Core entities; Postgres)

- **User** (existing) — add `AppleSubjectId string?` alongside `GoogleId`; one verified identity ⇒
  one account (dedupe by provider subject, then verified email).
- **Subscription** — `Id, UserId, Store ('apple'|'google'), ProductId, Plan ('premium'),
  OriginalTransactionId|PurchaseToken (unique per store), Status ('active'|'grace'|'on_hold'|
  'canceled'|'expired'|'refunded'), CurrentPeriodStart, CurrentPeriodEnd, AutoRenew bool,
  IsSandbox bool, LatestNotificationUtc, RowVersion`. The current entitlement is **derived** from
  the newest valid Subscription row.
- **CreditLedgerEntry** (append-only, auditable) — `Id, UserId, Type ('grant_onboarding'|
  'grant_subscription_period'|'grant_topup'|'consume'|'refund'|'expire'|'revoke'), Delta (+/-),
  PeriodKey (e.g. 'sub:<id>:2026-07' or 'lifetime'), Reason, IdempotencyKey (unique),
  SourceRef (transactionId/requestId), CreatedUtc`.
- **CreditBalance** (materialized cache for fast reads + atomic decrement) — `UserId (pk),
  Balance int, PeriodKey, UpdatedUtc, RowVersion`. Always reconcilable from the ledger.
- **AiAnalysisAudit** — `Id, UserId, ProviderId, Model, InputKind, EstimatedCostCents,
  LedgerEntryId, CreatedUtc` (cost observability + dispute support).
- **StoreWebhookEvent** (idempotency/dedupe) — `Id, Store, NotificationUuid (unique), Type,
  SignedDate, PayloadHash, ProcessedUtc, Result`.
- **DeviceBinding** (abuse signal) — `Id, UserId, DeviceId, FirstSeenUtc, LastSeenUtc`; unique
  `(UserId, DeviceId)`; used to flag many-accounts-per-device.

Money/credits are **integers**. All timestamps **UTC**, server-clock authoritative.

---

## 3. AI credit ledger & atomic decrement

**Model:** append-only ledger + a materialized `CreditBalance`. Balance is the source of truth for
"can I spend now"; ledger is the audit trail and rebuild source.

**Grants:**
- **Free onboarding:** one `grant_onboarding` of 1 credit, `PeriodKey='lifetime'`, created once per
  account (idempotent on UserId). Verified accounts only.
- **Premium period:** on entering an active period, `grant_subscription_period` of the monthly quota
  (30) with `PeriodKey='sub:<id>:<yyyy-mm>'`. Computed **lazily** at request time (no cron): if the
  current period has no grant row yet, create it inside the spend transaction. Unused credits do **not**
  roll over (each period grants fresh).
- **Top-ups (later):** consumable purchase → validated → `grant_topup` (non-expiring or period-scoped).

**Atomic decrement (the critical path):** inside one serializable DB transaction:
1. Resolve entitlement (active/grace) — else `403 no_entitlement`/`requires_account`.
2. Ensure the current-period grant exists (lazy grant).
3. `UPDATE CreditBalance SET Balance = Balance - 1, RowVersion = ... WHERE UserId=@u AND Balance > 0`
   — 0 rows affected ⇒ `402 no_credits` (fail closed). Write a `consume` ledger entry with the
   request's **IdempotencyKey** (retries return the same result, never double-charge).
4. **Reserve, then call the model.** If the AI call fails/times out, write a compensating `refund`
   entry + restore balance in a follow-up transaction (credit not burned on provider failure).
5. Commit; write `AiAnalysisAudit`.

Concurrency: the conditional `UPDATE ... WHERE Balance > 0` + `RowVersion` makes concurrent
requests safe without overspend. Idempotency key (client-generated per analysis) dedupes retries.

---

## 4. API endpoints (contract — keeps the app mostly unchanged)

User-authenticated (Bearer app-JWT):
- `POST /api/auth/google` · `POST /api/auth/apple` → validate provider ID token → upsert User →
  app JWT pair. (Google exists; Apple is new — `AppleAuthService` mirrors `GoogleAuthService`.)
- `GET  /api/entitlements` → `{ plan, status, productId, expiresAt, store, source:'server' }`.
- `GET  /api/coach/credits` → `{ policyKind, total, used, remaining, periodEnd }`.
- `POST /api/coach/analyze` `{ input, idempotencyKey }` → reserves a credit + returns the structured
  `CoachAnalysis`; or `402 {reason:'no_credits'}` / `403 {reason:'requires_account'|'no_entitlement'}`
  / `429 {reason:'rate_limited'}`. (Maps 1:1 to the client's existing `CoachError`.)
- `POST /api/billing/validate` `{ store, token }` → (re)validate a just-completed purchase, refresh
  the Subscription + entitlement, return entitlement. Client calls this right after purchase for a
  snappy unlock (webhooks are the durable backstop).

Store→server (NOT app-JWT; authenticated by signature / Pub/Sub):
- `POST /api/webhooks/apple` (App Store Server Notifications V2, JWS-verified) —
  `POST /api/webhooks/google` (RTDN via Pub/Sub push, OIDC-verified). Idempotent; update Subscription +
  entitlement + credit grants.

**Client mapping (additive, no UI changes):** `EntitlementsContext` reads `GET /entitlements`
(server) when authed+online, else local fallback; credit counter reads `GET /coach/credits`; a new
`serverCoachProvider` implements the existing `ICoachProvider` by calling `POST /coach/analyze`; the
client `IBillingProvider` keeps doing the store purchase, then calls `POST /billing/validate`.

---

## 5. Trust boundaries

| Zone | Trusted? | Notes |
|---|---|---|
| Mobile app, local entitlement/credit cache, "purchase succeeded" claim from client | **No** | UX only; never authoritative |
| Provider ID tokens (Google/Apple) | Only after **server-side signature/aud/iss/exp/nonce validation** | becomes app identity |
| Store receipt / transaction | Only after validation via store API (or RevenueCat) | source of entitlement |
| Store server notifications | Only after **signature/Pub-Sub verification + dedupe** | durable entitlement updates |
| T Poker API + PostgreSQL | **Yes** | sole writer of entitlements + ledger |
| AI vendor key | Server-only | never shipped to client |

The server treats the device as hostile: it independently validates every receipt and computes
entitlements/credits itself.

---

## 6. Failure modes & handling

- **Store validation API down (transient):** do **not** grant new premium (fail closed for grants),
  but do **not** revoke an already-validated entitlement on transient errors; retry w/ backoff; the
  webhook path reconciles. New purchases show "processing".
- **AI provider error after reserve:** compensating `refund` ledger entry → credit restored; user
  sees an error, not a charge.
- **Client retry / double submit:** idempotency key ⇒ same outcome, single decrement.
- **Webhook replay / out-of-order:** dedupe by `NotificationUuid`; apply only if `SignedDate` newer
  than `Subscription.LatestNotificationUtc`.
- **Refund / chargeback:** notification → `Status='refunded'` → revoke entitlement immediately;
  optionally `revoke` remaining period credits.
- **Grace / billing retry:** `Status='grace'` keeps premium active until the grace deadline, flagged
  so the UI can nudge "update payment".
- **Clock skew / period boundaries:** server clock authoritative; periods derived from subscription
  dates, not device time.
- **Offline client:** shows cached state; any AI action requires a server round-trip → fails closed
  offline (no free analyses).
- **Ledger/balance drift:** balance is reconcilable from the append-only ledger (nightly check + repair).

---

## 7. Per-account abuse / fraud prevention

- **Verified-only identities** (Google/Apple) — no disposable-email signups; one human ≈ one account.
- **Account-based credits** (not device) — reinstall/multi-device can't farm; onboarding credit is a
  one-time grant per account.
- **Device binding + velocity:** record `DeviceBinding`; flag/limit many-accounts-per-device and
  rapid signup bursts per IP/device; throttle or require step-up on anomalies.
- **Rate limiting (extend existing `UseRateLimiter`):** per-account token bucket on `/coach/analyze`,
  stricter limits on `/auth/*`, allowlist + signature checks on `/webhooks/*`.
- **Server credit cap is the hard ceiling** regardless of client behavior (fail closed).
- **Sandbox isolation:** sandbox/TestFlight receipts never grant production credits (`IsSandbox`).
- **Refund clawback** + abuse review flags; quotas/prices are server config (change without an app update).

---

## 8. Security assumptions

- TLS everywhere; secrets in env (Railway `__` keys), never in the client.
- Apple JWS verified against Apple's rotating public keys; `aud` = bundle/services id, `iss` =
  `https://appleid.apple.com`, `exp` checked, login uses a server-issued **nonce**.
- Google ID tokens validated via `Google.Apis.Auth` against `GoogleSettings:ClientIds`; Play RTDN
  authenticated by Pub/Sub push OIDC; Play Developer API via a least-privilege service account.
- Webhooks authenticated by **signature/OIDC, not app-JWT**; replay-protected (UUID dedupe + signedDate).
- AI vendor key server-only; per-user authorization on all user endpoints (`ExceptionHandlingMiddleware`
  maps 401/403/402/409/429); least-privilege DB; PII minimized (store provider subject, not raw tokens).

---

## 9. What stays client-side vs must be server-side

| Concern | Client (UX) | Server (authoritative) |
|---|---|---|
| Purchase flow (StoreKit/Play sheet) | ✅ initiate | validates the resulting receipt |
| "Is the user premium?" | cache for display | ✅ computed from validated subscription |
| AI credit balance | cache for display | ✅ ledger + atomic decrement |
| Running the AI model | ❌ (no vendor key) | ✅ proxied, credit reserved first |
| Entitlement on renew/cancel/refund | reflects server | ✅ from store notifications |
| Quotas / prices | rendered from config | ✅ server config (remote-tunable) |
| Rate limiting / fraud | soft hints | ✅ enforced |

Rule of thumb: **anything that gates money or cost is server-side; the client only renders it.**

---

## 10. Rollout plan (sandbox → staging → prod, each behind flags)

- **B1 — Auth hardening.** Add `AppleAuthService` + `POST /api/auth/apple`; client Apple button;
  remove open email self-registration (verified providers only). No billing. (Unblocks "verified identity".)
- **B2 — Server entitlements read path.** `GET /api/entitlements` (initially admin/manual grants);
  client `EntitlementsContext` prefers server when authed+online (flagged). Still no real purchases.
- **B3 — Receipt validation + webhooks (sandbox).** `IBillingVerifier` (RevenueCat first) + Apple/
  Google notification webhooks → server-authoritative Subscription/entitlement. Validate in sandbox/
  TestFlight end-to-end (renew, cancel, grace, refund).
- **B4 — Server AI proxy + credit ledger.** `POST /api/coach/analyze` with atomic decrement + refund-
  on-failure; switch the client `ICoachProvider` to `serverCoachProvider` (flag); retire reliance on
  client-only credit checks. Load/concurrency test the decrement path.
- **B5 — Top-ups + fraud tuning + launch.** Consumable top-up grants; velocity/device-binding rules;
  observability (validation-failure rate, decrement latency, webhook lag, refund rate). Only then flip
  `paywall` + billing ON in production.

**Definition of "safe to charge":** B1–B4 live in production, sandbox receipts proven, atomic
decrement load-tested, webhooks idempotent + monitored, refunds revoke access, and the client can no
longer obtain AI/premium without a server grant.

---

## 11. Effort / dependencies (high level, not committed)

- Accounts/infra: Apple App Store Connect API key + ASSN V2; Google Play service account + Pub/Sub RTDN;
  (or RevenueCat project). AI vendor account + server key.
- Backend: ~6 new entities + migrations, `AppleAuthService`, `IBillingVerifier` (+ RevenueCat impl),
  webhook controllers, entitlement service, credit-ledger service (atomic), AI proxy handler, rate-limit
  policies. All within the existing CQRS/EF conventions.
- Client: 3 thin additive providers (server entitlements read, `serverCoachProvider`, post-purchase
  validate) — **no screen rewrites**; existing contexts/components unchanged.

---

## B1 — Auth hardening (EXECUTED on `feature/v2-poker-platform`; no billing)

Verified-only identity foundation, fail-closed. Backend:
- `User` gains `EmailVerified` + `AppleSubjectId` (+ `CreateWithApple`/`LinkApple`/`MarkEmailVerified`);
  EF config + migration `B1_AuthHardening` (codegen only — **not applied to any DB**).
- `IAppleAuthService` + `AppleAuthService` (validates Apple identity JWT vs Apple JWKS: signature,
  iss=`appleid.apple.com`, aud ∈ `AppleSettings:ClientIds`, exp, optional nonce; JWKS cached; fail-closed).
- `AppleLogin` command/handler/validator/response + `POST /api/auth/apple` (subject-first match;
  links to a same-email account only when Apple verifies a real non-relay email; relay/no-email →
  unique placeholder account; `EmailVerified` set from the provider).
- `RegisterCommandHandler` gated on `IAuthPolicy.AllowEmailRegistration` (**default false** via
  `AuthSettings`) → open email signup disabled; legacy `/auth/login` + refresh untouched.
- `GoogleLoginCommandHandler` sets `EmailVerified=true` + verified-link guard.
- `IAuthAbuseGuard` seam (logging no-op) on social login / refresh reuse; `/auth/apple` rate-limited
  via the existing `auth-login` policy. Sessions keep rotating-refresh + token-family revocation.
- New `src/PokerApp.Tests` (xUnit + EF InMemory + auth fakes): **14 tests** — Apple
  new/relay/subject-match/invalid/email-link, Google verified-link, register gate, JWT claims, refresh
  rotation + family revocation. `dotnet build` + `dotnet test` green.

Client: thin `authApi.appleLogin` + `AuthContext.appleLogin` only (no button UI / no
`expo-apple-authentication` dep yet). Deferred to B2+/later: real IAP + receipts, server entitlements
+ AI credit ledger/atomic decrement + AI proxy, email-verification sending, the client Apple button.

---

## B2 — Server-authoritative enforcement (EXECUTED on `feature/v2-poker-platform`; NO live billing)

The layer that makes paid launch safe. Client credits/entitlements are now UX-only; the server
is the source of truth. Fail-closed throughout. Mock verifier + mock AI provider behind the seams.

- **Entities (+ EF config + migration `B2_MonetizationEnforcement`, codegen only — NOT applied):**
  `Subscription` (entitlement source: status/period/store/originalTransactionId, out-of-order-safe
  via `LatestEventAtUtc`), append-only `CreditLedgerEntry` (+ unique `IdempotencyKey`), materialized
  `CreditBalance` (per user+period), `StoreWebhookEvent` (dedupe).
- **Entitlements:** `IEntitlementService` computes premium from the newest `IsPremiumActive` subscription
  (Active/Grace/Canceled within period; Refunded/Expired → free). `GET /api/entitlements`.
- **AI credits:** `ICreditLedger` (`CreditLedger`) — lazy per-period grants (free `lifetime`=1 /
  premium `premium:yyyy-MM`=30, **configurable via `AiCreditSettings`**), **atomic decrement** in a
  serializable transaction, **idempotent** (unique key → no double-charge), **refund-on-failure**,
  rate limit, top-up support. `GET /api/coach/credits`.
- **AI proxy + key protection:** `ICoachAiProvider` (`MockCoachAiProvider`; vendor key server-only).
  `POST /api/coach/analyze` ([Authorize] → no anonymous AI) reserves a credit, then calls the model;
  refunds on provider failure. Deny → `402` (QuotaExceeded) / `429` (rate). `coach-analyze` rate policy.
- **Receipts + lifecycle:** `IBillingVerifier` (`MockBillingVerifier`) + `POST /api/billing/validate`
  (verify → upsert Subscription → entitlement). `POST /api/webhooks/{apple|google}` →
  `ProcessStoreNotification` (idempotent renew/cancel/expire/grace/refund; signature verification is a
  deferred seam).
- **Fraud:** account-based credits (verified identity from B1, not device), atomic+idempotent ledger,
  per-account rate limits, fail-closed. Device-binding signal = remaining work.
- **Tests:** `src/PokerApp.Tests` now **26** (14 B1 + 12 B2): entitlement compute, lifetime/monthly
  caps + reset, idempotency, rate limit, refund, analyze gate + refund-on-failure, validate-purchase,
  webhook refund + dedupe. `dotnet build` + `dotnet test` green.

**Remaining before paid launch:** real `IBillingVerifier` (Apple/Google/RevenueCat) + store webhook
**signature verification**; apply the migration to prod; switch the client to the server
`ICoachProvider`/entitlements (B4 cutover); DB-level concurrency hardening (xmin/row-lock) +
load test on the decrement path; device-binding/velocity rules; then flip billing/paywall ON.

## B3 — Real verifier + signed webhooks (EXECUTED on `feature/v2-poker-platform`; NO live billing)

Replaces the mock verification seams with real, fail-closed signed-payload crypto. Decision: **direct
Apple/Google verification behind the vendor-agnostic `IBillingVerifier`** (RevenueCat can drop in later).
The offline-verifiable crypto is **fully unit-tested**; credential-bound store-API network calls are
**fail-closed stubs** (verified in a real sandbox at deploy — see "remaining").

- **Crypto primitives (`src/PokerApp.Infrastructure/Billing/`, fully tested):**
  `AppleJwsVerifier` — verifies Apple ES256 JWS (ASSN V2 `signedPayload` + StoreKit2 `signedTransaction`):
  parses the `x5c` header chain, validates it to **injected trusted Apple roots** via `X509Chain`
  (`CustomRootTrust`, `VerificationTime=now`) + leaf ECDsa signature (IEEE-P1363). Empty roots ⇒ fail closed.
  `GoogleOidcVerifier` — verifies the Pub/Sub push **OIDC JWT** (iss `accounts.google.com`, configured aud,
  injected signing keys, custom lifetime) offline.
- **Receipt verifiers:** `AppleBillingVerifier` (signed transaction → `VerifiedSubscription`;
  Sandbox/Production → `IsSandbox`), `GooglePlayBillingVerifier` (via `IGooglePlaySubscriptionsClient`),
  dispatched by store in `DirectBillingVerifier`. All fail closed to `null`.
- **Signed webhooks:** `IStoreNotificationVerifier` (`StoreNotificationVerifier`) — Apple: verify the outer
  JWS + the **nested `signedTransactionInfo` JWS**, map type/subtype → renew/cancel/expire/grace/refund;
  Google: OIDC-verify the request, decode the RTDN `data`, map `notificationType` → the same set. Both
  normalize to the existing `StoreNotificationDto`. `WebhooksController` now accepts **raw signed payloads**
  (Apple `{ signedPayload }`; Google Pub/Sub `{ message:{ data, messageId } }` + `Authorization`) → verify →
  `ProcessStoreNotificationCommand`; **any unverifiable payload → `401`, no state change**. Idempotency +
  out-of-order safety from B2 preserved.
- **Sandbox vs prod:** `BillingSettings.AcceptSandbox=false` ⇒ Sandbox receipts/events cannot grant prod
  entitlements (rejected). Production-safe default.
- **Config (centralized):** `BillingSettings { Provider: "mock"|"direct"; AcceptSandbox }`,
  `AppleStoreSettings { BundleIds[]; RootCertsPem[] }`, `GooglePlaySettings { PackageName; PubSubAudience;
  ServiceAccountJson? }`. DI selects mock vs direct by `Provider` (mock retained for dev/tests).
- **Stubs (fail-closed, TODO-at-deploy, NOT presented as verified):** `GooglePlaySubscriptionsClient`
  (Play Developer API — returns `null`), `GoogleOidcKeySource` live JWKS fetch (cached, fail-closed to empty).
- **Tests:** `src/PokerApp.Tests` now **49** (+23 vs B2): Apple JWS valid/tampered/untrusted-root/expired/
  no-roots, Google OIDC valid/bad-aud/bad-key/expired, notification verifier (Apple valid/tampered/sandbox-
  reject/cancel-map; Google valid/bad-aud/missing-header), Apple+Google billing verifier mapping +
  sandbox-reject + fail-closed. `dotnet build` + `dotnet test` green.

**Remaining before paid launch (B3 scope):** wire the live network impls behind the stubs (Apple App Store
Server API + Google Play Developer API) and verify against real store **sandbox**; supply real Apple root
PEM(s) + Google Pub/Sub OIDC audience in prod config; flip `Provider="direct"` + `AcceptSandbox=false`.
Then B4 (client cutover) and B5 (top-ups/fraud/observability).

## B4 — Client cutover to server enforcement (EXECUTED on `feature/v2-poker-platform`; NO live billing)

The client stops deciding premium/credits locally; it reads from the server and routes analyses through
the server proxy. The local credit engine remains ONLY as a fail-closed offline cache, never authority.
Coach itself stays flag-gated (`coach` OFF in prod) so nothing user-facing changes in prod yet.

- **Authority flag:** `SERVER_AUTHORITATIVE = true` (`features/premium/config.ts`) — single switch for the cutover.
- **API (`api/monetizationApi.ts`):** typed wrappers over `GET /api/entitlements`, `GET /api/coach/credits`,
  `POST /api/coach/analyze` on the shared `apiClient` (401 auto-refresh + retry). `mapCoachError` →
  `402→no_credits`, `429→rate_limited`, `401/403→requires_account`, **network/5xx/unknown → `unavailable`**
  (deny, no false paywall). `analyzeHand` throws `ServerCoachError { reason }`.
- **Server provider (`features/coach/providers/serverCoachProvider.ts`):** implements the existing client
  `ICoachProvider`; calls the proxy and maps `CoachAnalysisResult` → client `CoachAnalysis`. No token ⇒
  `requires_account` (no anonymous AI). Registered as provider id `server`.
- **Entitlements (`context/EntitlementsContext.tsx`):** signed-in tier from `GET /api/entitlements` via the
  pure, fail-closed `resolveEntitlement` (`features/premium/entitlementResolve.ts`) — server is authority;
  offline ⇒ last-known cache, **never upgrades on uncertainty**; guests always free. `refresh()` exposed
  (called from the paywall post-purchase/restore). AI credit POLICY still from config (one tunable source).
- **Coach state (`features/coach/state/CoachContext.tsx`):** credits from `GET /api/coach/credits`
  (`creditsRemaining`/`totalCredits`/`policyKind` reflect server numbers, local as offline fallback);
  `analyze()` runs through `serverCoachProvider`, catches `ServerCoachError` → `{ error }`, refreshes credits
  after each analysis. Guests denied before any network call.
- **UI:** `CoachInputScreen` handles the new `unavailable` reason (error toast); paywall calls
  `refreshEntitlement()` after purchase/restore. UI structure otherwise unchanged.
- **Tests (mobile):** 3 new suites, **+19 tests** (150 total): `monetizationApi` error mapping + proxy,
  `serverCoachProvider` mapping/fail-closed/rethrow, `entitlementResolve` fail-closed resolution. Existing
  local coach engine tests retained (offline path). `npx tsc --noEmit` + `npx jest` green.

**Remaining before paid launch (B4 scope):** none structurally — the client is server-authoritative behind
`SERVER_AUTHORITATIVE`. Flipping the `coach` feature flag ON (and a real AI provider server-side) lights it
up. B5 adds top-ups, fraud/velocity, and observability.
