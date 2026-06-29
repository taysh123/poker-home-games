# T Poker V2 — Final Architecture Review

**Branch:** `feature/v2-poker-platform` (not merged, no PR) · **Date:** 2026-06-20
**Method:** full-system audit — claims verified against source (not docs). Backend **66** tests + mobile **150** tests green; `dotnet build` + `npx tsc --noEmit` clean.
**Verdict:** the V2 enforcement + platform architecture is **sound and largely production-grade**. Remaining work is integration + configuration + polish, not redesign. Paid surfaces are intentionally gated OFF.

---

## 1. Product architecture

Monorepo: `apps/poker-mobile` (Expo SDK 54, iOS/Android/Web) + `src/` (.NET 8, Clean Architecture + CQRS/MediatR + EF Core/Postgres).

**Four Pillars (Play → Track → Study → Improve)** ship behind feature flags (`src/config/features.ts`): `bankroll`, `study`, `coach`, `paywall`, `v2Splash` are **all OFF in production**, ON in dev. So prod behaves exactly as the shipped v1 until each is flipped — a clean, low-risk migration strategy.

- **Play** (live cash + tournaments, local guest games) — production-shipped, mature.
- **Track** (`features/bankroll`) — local-only, complete MVP, flag-gated off.
- **Study** (`features/study`) — local-only preflop trainer, flag-gated off.
- **Improve** (`features/coach`) — AI hand coach, server-enforced, flag-gated off.

**Frontend pattern:** screen-owned data fetching, no global data store; two Axios patterns (shared `apiClient` w/ 401-refresh interceptor; per-call instances elsewhere). Entitlements/credits now flow through dedicated contexts (B4).

**Assessment:** consistent, well-layered. The flag-gated pillar rollout is the single best architectural decision here — it de-risks launch.

## 2. Security architecture

**Strong, with a few defense-in-depth gaps.**

- Middleware order correct: CORS → exception → compression → rate limiter → authn → authz (`Program.cs`). CORS before exceptions ensures error responses carry CORS headers.
- Exception→HTTP mapping complete (8 domain exceptions: 400/401/402/403/404/409/429/500+TraceId).
- Rate limiting on auth + coach: `auth-login` 10/min, `auth-register` 5/min, `auth-refresh` 20/min, `coach-analyze` 12/min.
- **No IDOR found** — all sampled command/query handlers (groups, sessions, settlements) verify membership/ownership against `ICurrentUserService.UserId` from validated JWT claims.
- No secrets committed: `appsettings.json` holds clearly-marked placeholders (JWT secret, DB password) + **public** OAuth client IDs; `appsettings.Production.json` leaves secrets empty for env injection.

**Gaps (none are launch-blocking, all are hardening):**
- ❗ **`AuthAbuseGuard` is a logging-only no-op** — failed-login/refresh-reuse/social-login signals are logged but never throttle or block. Brute-force/credential-stuffing is currently bounded only by the per-IP rate limiter. *(B5's `FraudEvaluator` exists for the AI surface but is not wired to auth.)*
- **Web tokens in `localStorage`** (default) are XSS-readable. `sessionStorage` mode exists (`setSessionMode(true)`) but isn't the default; no CSP headers on the API/SPA. Native uses encrypted SecureStore (fine).
- **No `UseHttpsRedirection()` / HSTS / security headers** (X-Frame-Options, X-Content-Type-Options). Acceptable behind Railway's TLS-terminating proxy, but should be explicit.
- `/health` is a static text response — no DB connectivity check.

## 3. Authentication

**Production-grade.** Verified real (not stubs):
- JWT: HS256, 15-min access / 30-day refresh; issuer+audience+lifetime+signature all validated; 30s clock skew.
- **Refresh-token rotation + reuse detection**: old token revoked on use; replay of a revoked token triggers **family revocation** (all sessions invalidated). Refresh tokens stored **SHA-256 hashed** (never plaintext); unique index on hash.
- **Apple Sign-In**: real RS256 verification against Apple JWKS (1h cached), issuer, audience allow-list (`AppleSettings:ClientIds`), nonce, expiry; fail-closed.
- **Google Sign-In**: official `Google.Apis.Auth` SDK; audience allow-list; fail-closed.
- **Password hashing**: BCrypt, work factor 12.
- **AuthPolicy** (real): open email registration OFF, email→social linking ON — hardened verified-identity-only posture (B1).

**Caveat:** Apple nonce is client-supplied; confirm the mobile client generates it with a CSPRNG (not audited on the device side).

## 4. Monetization

The deepest part of V2 (B1–B5), and the most defensively built.

- **Server is the source of truth** for subscription state, entitlements, AI credits, and top-ups. Client renders cache only (B4); it cannot grant premium/credits locally.
- **Credit ledger**: append-only entries + materialized balance; **atomic decrement under serializable transaction**; **DB-level idempotency** (unique key → no double-charge); **refund-on-provider-failure**. Lazy per-period grants; configurable quotas (free = 1 lifetime, premium = 30/month) with no schema change.
- **Store verification (B3)**: real, offline-unit-tested crypto — Apple ES256 JWS x5c→trusted-root + signature; nested transaction JWS; Google Pub/Sub OIDC JWT; sandbox-vs-prod separation; webhook bad-signature → 401 fail-closed; idempotent + out-of-order-safe webhook processing.
- **Top-ups (B5)**: config-driven bundles, idempotent grant path, **disabled by default** (empty + `Enabled=false` ⇒ every redeem fails closed).
- **Observability (B5)**: structured `IAuditLog` events (CreditSpend, CreditTopUp, AiUsage, AiCost, SubscriptionLifecycle, WebhookProcessing, Fraud).
- **Fraud (B5)**: `DeviceBinding` + multi-account + velocity scoring; **advisory by default** (`EnforceBlocking=false`).

**Not yet real (intentional seams/stubs):**
- `MockBillingVerifier` + `MockCoachAiProvider` are the active DI bindings (`BillingSettings.Provider="mock"`).
- `GooglePlaySubscriptionsClient` returns null (stub); Apple App Store Server API not called; `GoogleOidcKeySource` live JWKS fetch unverified against real Pub/Sub.
- Migrations `B2_MonetizationEnforcement` + `B5_FraudAndObservability` are **codegen only — not applied to prod**.

## 5. AI Coach architecture

- Vendor-agnostic `ICoachAiProvider` (server) — **the vendor key lives only server-side**; client never sees it.
- Flow: `[Authorize]` (no anonymous AI) → entitlement → policy → **reserve credit** → call model → **refund on failure**. Denials map to 402 (no credits) / 429 (rate). Client (`serverCoachProvider`) maps 402/403/429/network → `no_credits`/`requires_account`/`rate_limited`/`unavailable` (fail-closed).
- Structured, educational output contract (`CoachAnalysisResult`); explicitly "not solver/GTO-optimal."
- **Gap:** only `MockCoachAiProvider` exists — no real vendor wired. `AiCost` audit is a hook (logs provider id, no real cost number yet).

## 6. Bankroll architecture (Track)

- Local-only (AsyncStorage `tpoker.bankroll.v1`), schema v1 + migration chain + corrupt-data quarantine. Integer-cents throughout. Pure analytics (ROI/ABI/ITM/$-hr) fully unit-tested. No backend, no premium gating, flag-off in prod.
- **Debt/gaps:** manual `YYYY-MM-DD` text entry (needs a native date picker); silent AsyncStorage write failures (no UI feedback); no UI/integration tests; no cloud sync (type model is sync-ready: ISO timestamps, UUIDs).

## 7. Study architecture (Improve/preflop)

- Local-only (`tpoker.study.v1`), same versioned-store + quarantine pattern. Pure logic (169-hand grid, range notation parser, streaks, trainer eval) fully unit-tested. Bundled `STARTER_DATASET` flagged `isIllustrative`. No backend/premium, flag-off.
- **Debt/gaps:** "Decision Trainer" mode flag exists but **doesn't filter spots** (behaves like random); no results/stats in continuous mode; dataset is **hardcoded** — import path advertised in UI but not built; no UI tests.

## 8. Scalability

- **Horizontally scalable:** stateless, async-first, no background timers/jobs, no blocking `.Result`/`.Wait()`. Credit decrement is transaction-safe on Postgres.
- **Per-instance static caches** (`AppleAuthService` JWKS, `GoogleOidcKeySource` OIDC) — correct but each pod re-fetches on cold cache (1h TTL; public keys; acceptable, not ideal → `IDistributedCache` later).
- **No N+1** — eager `.Include()` throughout; balances computed in-memory after batched reads.
- **Gaps:** no Npgsql `MaxPoolSize` tuning (uses defaults ~ up to 100); the decrement's serializable isolation is correct but **not load-tested under contention**; no read replicas/caching layer (not needed at current scale).
- Client polling (30s `ActiveSessionContext`, focus refresh) is modest; fine for expected load.

## 9. Cost-control design

Strong by construction — this was a primary goal and it shows.
- No anonymous AI; no uncapped AI; hard per-account quotas (free 1 lifetime / premium 30/mo), server-enforced, atomic + idempotent so retries/races can't over-spend.
- Refund-on-failure prevents paying for failed model calls without crediting the user.
- `coach-analyze` rate limit (12/min) + (advisory) velocity/multi-account fraud signals.
- `AiCost` audit hook ready to record real per-call spend for alerting.
- **Gap:** no real cost number flows yet (mock provider); no budget alarm wired (needs the audit events → dashboard/alert).

## 10. Technical debt (prioritized)

| # | Item | Area | Severity |
|---|------|------|----------|
| 1 | `AuthAbuseGuard` is a no-op (no brute-force/velocity blocking on auth) | Security | High |
| 2 | Mock billing verifier + mock AI provider are the live bindings | Monetization/AI | High (by design until launch) |
| 3 | Google Play subscriptions client is a stub; Apple Server API not called | Billing | High (launch blocker) |
| 4 | B2 + B5 migrations not applied to prod | Data | High (launch blocker) |
| 5 | Web tokens in `localStorage` (XSS) + no CSP/security headers | Security | Medium |
| 6 | No connection-pool tuning; decrement not load-tested | Scalability | Medium |
| 7 | Study "Decision Trainer" doesn't filter; dataset import not wired | Study | Medium |
| 8 | Bankroll date picker; silent write-failure UX | Track | Medium |
| 9 | No structured logging/APM; `/health` lacks DB check | Observability | Medium |
| 10 | No UI/integration tests for bankroll/study/coach screens | Quality | Low–Med |
| 11 | Per-instance JWKS/OIDC caches (vs distributed) | Scalability | Low |

## 11. Missing production requirements

- Apply pending migrations; real store network clients + real AI provider; prod env secrets (JWT secret, DB conn, Apple roots, Google service account + Pub/Sub audience).
- Auth abuse enforcement (turn the stub into real throttling/lockout).
- HTTPS redirect/HSTS + security headers + (web) CSP; deeper `/health` (DB check).
- Structured logging + an alerting dashboard over the `audit` events (spend/cost/fraud/webhook failures).
- Store assets/listing + privacy disclosures already largely prepared (`store-assets/`, `docs/store-release.md`).

## 12. Risks

- **R1 — Billing correctness in the wild (High):** crypto is unit-tested offline, but no real sandbox round-trip yet. Mitigation: mandatory Apple+Google sandbox verification before flipping `Provider=direct`.
- **R2 — AI unit economics (Med):** real model cost unverified vs the 30/mo quota at $11.99. Mitigation: measure cost/analysis in staging, wire `AiCost` alerts before paywall ON.
- **R3 — Auth abuse (Med):** no-op guard → credential stuffing only rate-limited per-IP. Mitigation: implement lockout/velocity before public growth.
- **R4 — Web XSS token theft (Med):** localStorage default. Mitigation: CSP + default to sessionStorage (or accept for native-first launch).
- **R5 — Decrement under contention (Low–Med):** correct design, unproven at load. Mitigation: load test.
- **R6 — Data migration on first prod deploy (Low):** deferred background migration could partially apply on a crash. Mitigation: apply migrations as a discrete, monitored step pre-cutover.

## 13. Recommended improvements before launch

**Must (launch blockers):** apply migrations; wire + sandbox-verify Apple/Google billing; integrate a real AI provider; set all prod secrets; verify AI unit economics.
**Should:** implement auth abuse blocking; add HTTPS redirect/HSTS/security headers + web CSP; structured logging + audit-event alerting; tune connection pool + load-test the decrement; deepen `/health`.
**Nice (V2.1):** finish Study Decision-Trainer filtering + dataset import; Bankroll date picker + write-error UX; distributed key cache; UI/integration test coverage.

---

### Bottom line
B1–B5 deliver a fail-closed, server-authoritative monetization core with production-grade auth, layered cleanly behind feature flags so nothing changes in prod until deliberately enabled. The architecture does not need rework — launch is a disciplined **integration + configuration + hardening** exercise, detailed in the companion **Production Integration Plan**.
