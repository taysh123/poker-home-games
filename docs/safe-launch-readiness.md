# Safe Launch Readiness Report — T Poker monetization (B1–B5)

**Branch:** `feature/v2-poker-platform` (NOT merged to main) · **Date:** 2026-06-19
**Scope:** server-authoritative entitlements, AI credits, store verification, client cutover, fraud + observability.
**Status headline:** the enforcement architecture is **complete and tested end-to-end**, but **paid launch is intentionally gated OFF**. Live billing, real store-API network calls, prod migrations, and the production paywall are all deliberately not enabled.

Tests: backend **66** (`dotnet test`) + mobile **150** (`npx jest`), all green. `dotnet build` + `npx tsc --noEmit` clean.

---

## ✅ Production-ready (built, tested, safe to ship as-is)

- **Server is the source of truth.** Entitlements (`GET /api/entitlements`), AI credits (`GET /api/coach/credits`), and analyses (`POST /api/coach/analyze`) are all server-computed. The client only renders cached state (B4).
- **Append-only credit ledger** with materialized balance, **atomic + serializable decrement**, **DB-level idempotency** (unique key, no double-charge), and **refund-on-provider-failure** (B2).
- **No anonymous AI / no client authority.** `[Authorize]` on every coach/billing endpoint; guests denied before any network call; client cannot grant premium or credits locally (B2/B4).
- **Fail-closed everywhere.** Unknown/offline/5xx → deny (`unavailable`), never a false unlock. Empty/disabled config → no grant.
- **Real signed-payload crypto** (offline-verified, fully unit-tested): Apple ES256 JWS x5c-chain-to-trusted-root + signature; Google Pub/Sub OIDC JWT; nested transaction JWS; sandbox-vs-prod separation; webhook signature → **401 fail-closed** (B3).
- **Idempotent + out-of-order-safe webhooks** (dedupe by notification UUID; `LatestEventAtUtc`) (B2/B3).
- **Observability/audit**: structured, alert-ready events for credit spend, AI usage, AI cost, subscription lifecycle, webhook processing, and fraud signals (B5).
- **Fraud detection** (device binding, multi-account, velocity, weighted scoring) — runs + audits in advisory mode safely (B5).
- **Top-up infrastructure** — config-driven, idempotent grant path, disabled by default (B5).
- **Auth hardening** — verified providers (Google/Apple), no open email self-registration, server-side token validation (B1).

## ⚠️ Not production-ready (built as a SEAM/STUB — must be finished before enabling)

| Area | State | What's missing |
|---|---|---|
| Apple receipt/network verification | `AppleBillingVerifier` verifies the JWS offline; **no App Store Server API call** | Real Apple **root CA PEM(s)** in config; sandbox integration test |
| Google Play verification | `GooglePlaySubscriptionsClient` is a **fail-closed stub** (returns null) | Real Play Developer API call + service-account creds |
| Google OIDC key source | `GoogleOidcKeySource` live JWKS fetch is wired but unverified against real Pub/Sub | Real Pub/Sub **OIDC audience** in config; live verification |
| Top-up consumables | grant path + config done | **Consumable receipt verification** before `TopUpSettings.Enabled=true` |
| Fraud blocking | scoring + signals + audit done | **Tuning against real traffic** before `EnforceBlocking=true`; client must send `DeviceId` |
| AI provider | `MockCoachAiProvider` only | A real vendor provider server-side (key server-only) |
| DB schema in prod | migrations `B2_MonetizationEnforcement`, `B5_FraudAndObservability` are **codegen only** | Apply to prod DB |
| Paywall / billing flag | mock billing; `coach` + `paywall` flags **OFF in prod** | Flip when above are done |

## 🚧 Remaining launch blockers (ordered)

1. Apply the two pending migrations to the production (Railway) database.
2. Wire + sandbox-verify the live Apple App Store Server API and Google Play Developer API behind the existing seams; set `BillingSettings.Provider="direct"`, `AcceptSandbox=false`, real Apple roots + Google audience.
3. Implement a real server-side AI provider (vendor key server-only) and replace the mock.
4. Wire consumable receipt verification before enabling top-ups.
5. Send a `DeviceId` from the client into `AnalyzeHand`; tune `FraudSettings`, then enable `EnforceBlocking`.
6. Load-test the decrement path under concurrency (xmin/row-lock behavior on Postgres).
7. Store review prerequisites (below) + flip `coach`/`paywall` flags ON.

---

## Deployment checklist
- [ ] Apply `B2_MonetizationEnforcement` + `B5_FraudAndObservability` to prod DB (backup first).
- [ ] Set prod env: `BillingSettings__Provider`, `BillingSettings__AcceptSandbox=false`, `AppleStoreSettings__RootCertsPem__0`, `AppleStoreSettings__BundleIds__0`, `GooglePlaySettings__PackageName`, `GooglePlaySettings__PubSubAudience`, `GooglePlaySettings__ServiceAccountJson`.
- [ ] Set `FraudSettings__*` thresholds; keep `EnforceBlocking=false` until tuned.
- [ ] Keep `TopUpSettings__Enabled=false` until consumable verification ships.
- [ ] Confirm `AllowedOrigins`, `AppSettings__WebBaseUrl` for prod domain.
- [ ] Verify pipeline order in `Program.cs` (CORS → exception → compression → rate limiter → authn → authz).
- [ ] Configure store webhook endpoints → `/api/webhooks/apple` + `/api/webhooks/google`.
- [ ] Dashboards/alerts on the `audit` structured events (spend, cost, fraud, webhook failures).

## Billing checklist
- [ ] Apple: products + subscriptions configured in App Store Connect; App Store Server Notifications V2 → webhook URL.
- [ ] Google: products + subscriptions in Play Console; RTDN Pub/Sub topic + push subscription with OIDC audience → webhook URL.
- [ ] `POST /api/billing/validate` exercised in sandbox for both stores (creates/syncs `Subscription`).
- [ ] Refund/cancel/expire/grace webhook paths verified to flip entitlement.
- [ ] Idempotency + out-of-order replay verified against real notifications.
- [ ] Pricing finalized ($11.99/mo, $79.99/yr) and consistent with store products.

## AI provider checklist
- [ ] Choose vendor; implement `ICoachAiProvider` server-side; **API key in server env only**.
- [ ] Map vendor output → `CoachAnalysisResult`; enforce timeouts + cancellation.
- [ ] Confirm refund-on-failure path covers vendor errors/timeouts.
- [ ] Populate `AiCost` audit with real per-call cost; set alert thresholds on spend.
- [ ] Validate free=1 lifetime / premium=30/month quotas (configurable) against unit economics.
- [ ] Abuse: confirm rate limiter (`coach-analyze`) + velocity thresholds are sane for the chosen model cost.

## Apple checklist
- [ ] App Store Connect: bundle id `com.tpoker.app`, subscription group + products.
- [ ] Apple **root CA PEM** added to `AppleStoreSettings.RootCertsPem`.
- [ ] App Store Server Notifications V2 endpoint set; sandbox notification received + verified (JWS chain).
- [ ] Sign in with Apple verified (B1 path) in prod.
- [ ] EAS iOS build with `EXPO_PUBLIC_API_URL` + Google iOS client id; push needs an EAS dev build (not Expo Go).
- [ ] Privacy + subscription disclosures present (paywall fine print already drafted).

## Google checklist
- [ ] Play Console: package `com.tpoker.app`, subscription products.
- [ ] Service account JSON with Play Developer API access → `GooglePlaySettings.ServiceAccountJson`.
- [ ] RTDN Pub/Sub topic + push subscription; **OIDC audience** → `GooglePlaySettings.PubSubAudience`.
- [ ] Sandbox RTDN received + OIDC-verified end-to-end.
- [ ] `GooglePlaySubscriptionsClient` live implementation replaces the stub; sandbox purchase validated.
- [ ] Android OAuth client ids set for prod build.

---

**Bottom line:** B1–B5 deliver a safe, fail-closed, server-authoritative monetization core that is fully tested offline. Nothing bills, blocks, or unlocks in production yet. Going live is now a **configuration + integration** exercise (apply migrations, wire the two store network clients, add a real AI provider, tune fraud, flip flags) — not an architecture change.
