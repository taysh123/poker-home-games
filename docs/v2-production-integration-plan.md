# T Poker V2 — Production Integration Plan

**Branch:** `feature/v2-poker-platform` (no PR/merge yet) · **Date:** 2026-06-20
**Companion to:** `docs/v2-final-architecture-review.md` and `docs/safe-launch-readiness.md`
**Goal:** a sequenced, reversible path from "fully built + tested, gated OFF" to "live paid V2" — with each gate flippable independently and rollback at every step.

> Guiding rule: **flags stay OFF and providers stay `mock` until each integration is sandbox-verified.** Every step is independently reversible (flag flip or env revert).

---

## A. What is production-ready today

- v1 core (auth, groups, sessions, settlements, stats, local guest games, tournaments) — already live.
- Server-authoritative entitlements + AI credit ledger (atomic, idempotent, refund-on-failure).
- Real auth: JWT rotation + reuse detection, BCrypt(12), real Apple/Google token validation, hardened AuthPolicy.
- Store-verification crypto (Apple JWS / Google OIDC), idempotent + out-of-order-safe webhooks — offline-tested.
- Fraud detection + structured audit (advisory), top-up infra (disabled), client cutover to server (B4).
- Bankroll + Study features (local-only) — functional MVPs behind flags.
- Backend ops basics: correct middleware order, rate limiting, `/health`, deferred non-blocking migrations, env-based secrets, CORS allow-list.

## B. What is NOT production-ready

- Live billing: `MockBillingVerifier` is the active binding; Google Play client + Apple Server API are stubs; B2/B5 migrations unapplied.
- Real AI provider: only `MockCoachAiProvider`; no measured cost.
- Auth abuse enforcement: `AuthAbuseGuard` is a no-op.
- Prod secrets/config: JWT secret, DB conn, Apple root certs, Google service account + Pub/Sub audience must be set.
- Web hardening: localStorage tokens (XSS), no CSP/HSTS/security headers, no HTTPS redirect, shallow `/health`.
- Study Decision-Trainer filtering + dataset import; Bankroll date picker; UI test coverage.

## C. What should be improved before release

Auth abuse blocking; HTTPS redirect + HSTS + security headers + web CSP; structured logging + alerting over audit events; Npgsql pool tuning + load-test of the credit decrement; deeper `/health` (DB check); verify AI unit economics.

## D. What can wait until V2.1 / V3

- V2.1: Study Decision-Trainer filtering + verified dataset import; Bankroll native date picker + write-error UX; UI/integration tests; distributed (Redis/`IDistributedCache`) JWKS/OIDC cache; RevenueCat drop-in (optional); per-feature premium gating for Bankroll/Study.
- V3: cloud sync for local features; multi-tier/multi-currency; read replicas/caching; advanced anti-fraud (ML signals); web httpOnly-cookie auth.

---

## 1. Apple integration requirements

1. App Store Connect: paid-apps agreement; create the app, **auto-renewable subscription group** + products (monthly `tpoker.premium.monthly`, yearly `tpoker.premium.yearly`); optional consumable top-up products.
2. Generate an **App Store Server API** key (Issuer ID + Key ID + .p8) for server-side transaction lookup.
3. Configure **App Store Server Notifications V2** → `https://<api>/api/webhooks/apple` (prod + sandbox URLs).
4. Obtain the **Apple Root CA (G3) PEM** → `AppleStoreSettings__RootCertsPem__0`; set `AppleStoreSettings__BundleIds__0=com.tpoker.app`.
5. Finish `AppleBillingVerifier`/`StoreNotificationVerifier` against the App Store Server API (transaction/subscription status lookup) — the JWS verification + seam already exist.
6. Sign in with Apple already validated server-side; ensure the **device generates a CSPRNG nonce**.
7. Client: EAS iOS build with `EXPO_PUBLIC_API_URL` + iOS Google client id; StoreKit purchase flow → `POST /api/billing/validate`. Push needs an EAS dev build (not Expo Go).

## 2. Google integration requirements

1. Play Console: create app, **subscription products** matching the Apple SKUs; optional consumable top-ups.
2. **Service account** with Google Play Developer API access → `GooglePlaySettings__ServiceAccountJson`; set `GooglePlaySettings__PackageName=com.tpoker.app`.
3. **Real-time developer notifications**: Pub/Sub topic + **push subscription** with an OIDC audience → `GooglePlaySettings__PubSubAudience`; push endpoint `https://<api>/api/webhooks/google`.
4. Implement `GooglePlaySubscriptionsClient` (currently a fail-closed stub) against the Play Developer API; verify `GoogleOidcKeySource` live JWKS fetch.
5. Android OAuth client ids for the prod build; Google Sign-In already validated server-side.
6. Client: EAS Android build; Play Billing purchase flow → `POST /api/billing/validate`.

## 3. Billing activation requirements

Order matters — **do not flip these until sandbox-verified:**
1. Apply migrations `B2_MonetizationEnforcement` + `B5_FraudAndObservability` to prod DB (backup first).
2. Set store config (Apple roots/bundle, Google service account/audience), then `BillingSettings__Provider=direct`, `BillingSettings__AcceptSandbox=false`.
3. Sandbox round-trips both stores: purchase → `validate` (subscription created); renew/cancel/expire/grace/refund webhooks flip entitlement; replay + out-of-order dedupe verified.
4. Keep `TopUpSettings__Enabled=false` until consumable receipt verification is implemented.
5. Flip client flags **last**: `paywall` then `coach` (see Launch sequence). Pricing confirmed: $11.99/mo, $79.99/yr.

## 4. AI provider integration options

Implement `ICoachAiProvider` server-side (vendor key server-only). Options:

| Option | Pros | Cons | Fit |
|---|---|---|---|
| **Anthropic Claude (Haiku 4.5)** ★ recommended default | Cheapest capable tier, fast, strong reasoning for structured coaching, same vendor as the rest of the stack | — | Best cost/quality for high-volume short analyses |
| Anthropic Claude (Sonnet 4.6) | Higher-quality nuanced coaching | ~5–8× Haiku cost | Premium "deep analysis" upsell later |
| OpenAI GPT-class | Familiar tooling | Separate vendor/keys | Viable alternative |
| RevenueCat (billing only, not AI) | Abstracts Apple/Google billing | Adds a dependency/fee | Optional — the seam is already RevenueCat-ready |

Requirements regardless of vendor: strict timeout + cancellation; map output → `CoachAnalysisResult`; confirm refund-on-failure covers timeouts/errors; populate the `AiCost` audit with real per-call cost; keep free=1/premium=30 quotas until economics are confirmed.

## 5. Cost estimates (validate against current vendor pricing before launch)

**Per AI analysis** (≈1–2k input + ≈1k output tokens, structured coaching):
- Claude Haiku-class: **~$0.003–$0.01 / analysis** → a premium user at 30/mo ≈ **$0.10–$0.30 / mo** in AI cost vs **$11.99** revenue ⇒ **>95% gross margin** on the AI line. Free tier (1 lifetime) ≈ a few cents, one-time.
- Sonnet-class: ~5–8× the above — still a small fraction of revenue at 30/mo.

**Infrastructure (monthly, small-scale):**
- Railway (API + Postgres): ~$10–40 depending on instance/usage.
- Vercel (web/SPA): $0 hobby → ~$20 Pro.
- Expo/EAS builds: free tier or ~$0–$99/mo if on a paid plan.
- Apple Developer $99/yr; Google Play $25 one-time.

**Takeaway:** unit economics are healthy by design (the whole point of B2–B5). The dominant risk is not margin but **mis-metered/unbounded AI** — already mitigated by quotas + idempotency + refund + rate limit. **Action:** confirm live token prices, then set an `AiCost` budget alarm.

## 6. Deployment sequence

1. **Pre-flight:** finalize PR review of `feature/v2-poker-platform`; CI green (backend `dotnet test`, mobile `tsc`+`jest`); tag a backup of current prod (`main`) + DB backup.
2. **Secrets/config (Railway):** `JwtSettings__SecretKey`, `ConnectionStrings__DefaultConnection`, `AllowedOrigins__*`, `AppSettings__WebBaseUrl`; billing/fraud/top-up config (keep `Provider=mock`, flags off for the first deploy).
3. **DB migration:** apply B2 + B5 as a discrete, monitored step (not relying on the deferred background migrator) against the backed-up DB.
4. **Backend deploy** (flags/providers still safe-default) → smoke test `/health`, auth, sessions.
5. **Wire store + AI integrations** (env + real clients), redeploy.
6. **Web/EAS builds** with prod env; submit store builds for review (flags still off in the binary's prod config or server-gated).
7. **Flip flags** per the Launch sequence once everything is sandbox-verified.

## 7. Testing sequence

1. **Unit/integration (already green):** backend 66, mobile 150 — keep as the CI gate.
2. **Backend smoke (staging):** auth (login/refresh rotation/reuse), session lifecycle, entitlements/credits endpoints, webhook 401-on-bad-signature.
3. **Billing sandbox (both stores):** purchase→validate; each lifecycle webhook flips entitlement; replay + out-of-order dedupe; sandbox-rejected-in-prod.
4. **AI provider (staging):** real analysis happy path; provider failure → credit refunded; quota exhaustion → 402; rate limit → 429; measure cost/analysis.
5. **Fraud (staging):** with `EnforceBlocking=true` + low thresholds, confirm multi-account/velocity blocks; then return to advisory for launch.
6. **Load test:** concurrent credit decrement (no over-spend), connection-pool behavior.
7. **Client E2E:** purchase → entitlement refresh → coach unlock; offline → fail-closed; 402/403/429/unavailable mapping; web + native.
8. **Security pass:** confirm no secrets in build, CSP/headers (if added), token storage mode on web.

## 8. Launch sequence (staged, reversible)

1. Backend live with `Provider=direct`, billing **server-ready** but client `paywall`/`coach` flags **OFF** → server enforces, nothing user-visible.
2. **Internal/TestFlight + Play internal track:** enable flags for internal testers only; run real (sandbox) purchases.
3. **Soft launch:** flip `coach` ON for a small % / region; keep `EnforceBlocking=false`; watch `AiCost`, error rates, webhook health.
4. **Paywall ON** (`paywall` flag) for the cohort; verify conversion + entitlement correctness.
5. **Tune fraud** thresholds from real data → flip `EnforceBlocking=true`.
6. **General availability:** flags ON for all; Bankroll/Study flipped when their V2.1 polish lands (or earlier as free features).

## 9. Rollback strategy

Layered, fastest-first — most issues need only a flag flip, not a redeploy:
- **Feature flag rollback (seconds):** flip `coach`/`paywall` OFF → coach + paywall vanish; app reverts to v1 behavior. (Client flags are build-time today → see V2.1 note to make them server-driven for instant remote kill.)
- **Provider rollback (1 env change + restart):** `BillingSettings__Provider=mock` → billing verification reverts to the safe no-op; entitlements already granted persist; no new charges processed.
- **Fraud rollback:** `EnforceBlocking=false` → stop blocking immediately (detection/audit continue).
- **AI rollback:** swap `ICoachAiProvider` DI back to mock (or disable `coach`) if a vendor outage/cost spike hits.
- **Backend rollback:** redeploy the previous tagged image; the DB is **forward-compatible** (B2/B5 are additive tables/columns — old code ignores them), so a code rollback does **not** require a DB rollback.
- **DB rollback (last resort):** restore the pre-migration backup; only needed if a migration itself is faulty (each has a tested `Down`).
- **Store note:** published store builds can't be "unpublished" instantly — hence server-side gating (flags/provider) is the real kill switch; keep client flags server-driven (V2.1) so a bad release is neutralized without an app update.

---

### Net
Going live is a sequence of **independently reversible gates** (migrations → store config → `Provider=direct` → flags), each verified in sandbox/staging before the next. No architectural change is required; the build is already fail-closed and server-authoritative. Recommended near-term hardening (auth abuse blocking, web/security headers, observability alerting, load test, AI economics check) should land before GA but not before internal/sandbox validation begins.
