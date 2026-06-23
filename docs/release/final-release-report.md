# Final Release Hardening + Commercial Foundations — Report

> **Status: COMPLETE on the held branch `feature/v2-poker-platform`. NOT merged, NOT deployed.** Every change
> is additive / fail-closed / flag-gated; production behaviour is unchanged (mock billing, mock AI, paywall +
> coach + content + mastery flags OFF). Real billing, real AI, and final legal copy are **external-blocked** —
> they are scaffolded, tested, and documented honestly here, never faked.

**Branch:** `feature/v2-poker-platform` → PR **#2** · ahead of `main` ~80 commits, clean fast-forward (0 conflicts).
**This program's commits:** `dbffb38` (A) · `5f3d1b8` (B) · `a937d95` (C) · `c3849ec` (D) · `a0c0ee4` (E) ·
`b1ac831` (F) · `abec400` (G fixes).
**Gates (re-run at the merge SHA before cutover):** `dotnet build` clean · **82** backend tests · `tsc` clean ·
**393** jest / 46 suites · `expo export -p web` clean.

---

## Update — Commercial build: RevenueCat / Stripe / Anthropic (June 2026)
A second program implemented the now-DECIDED vendors on the same held branch (commits `70affae` onward).
**Still held — no merge, no deploy.** Mock providers stay active; `paywall`/`coach` flags OFF; production
byte-identical. Gates re-run green: `dotnet build` + 110 backend tests; `tsc`; 393+ jest; web export.

- **Decisions (locked):** mobile = RevenueCat, web = Stripe, AI = Anthropic, pricing $11.99/mo + $99.99/yr,
  server-authoritative entitlements, keys server-side. See `docs/commercial/commercial-decision-record.md`.
- **AI (built):** `AnthropicCoachAiProvider` (real Messages API, behind the server key, fail-closed, refunds on
  failure); `CoachAiSettings:Provider=anthropic`; mock default. `docs/commercial/ai-architecture.md`.
- **Billing (built, dormant):** Stripe + RevenueCat verifiers + `/api/webhooks/{stripe,revenuecat}`
  (signature-verified) + `POST /api/billing/checkout`; `SubscriptionStore` += Stripe/RevenueCat; client Stripe
  adapter wired (key-gated) + RevenueCat key-gated stub. `docs/commercial/billing-architecture.md`.
- **Legal:** Terms updated with $11.99/$99.99 + processors (counsel-owned DRAFT); Privacy payments note.
- **Cost:** refreshed for Anthropic (Sonnet) + Stripe/RevenueCat fees. `docs/review/cost-scalability.md`.
- **Config-driven:** no hardcoded keys/secrets/IDs/URLs; empty settings ⇒ fail closed.

### Updated external blockers + human actions (supersedes §J/§K below for commercial)
1. **Stripe:** account, 2 recurring Prices, secret + publishable keys, webhook signing secret → `StripeSettings__*`
   + `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`; point the webhook at `/api/webhooks/stripe`.
2. **RevenueCat:** account/project, public SDK key + secret REST key + webhook Authorization secret →
   `EXPO_PUBLIC_REVENUECAT_API_KEY` + `RevenueCatSettings__*`; point the RevenueCat webhook at
   `/api/webhooks/revenuecat`; **`npm i react-native-purchases`** + implement the documented SDK calls.
3. **Apple/Google:** subscription products + paid-apps agreements (RevenueCat manages store notifications).
4. **Anthropic:** API key + spend budget → `CoachAiSettings__Provider=anthropic` + `CoachAiSettings__ApiKey`.
5. **Counsel:** finalize `terms.html` (linked from the production Profile screen → required before merge).
6. **Go-live config + flip:** `BillingSettings__Provider=direct` + `AcceptSandbox=false`; `AppSettings__WebBaseUrl`;
   flip client `COACH_CONFIG.provider="server"` + `resolvePlatformBillingProvider()`; then flip `paywall`/`coach`
   flags + merge per `v2-deployment-checklist.md`.

---

## A — Release-doc audit
Reconciled `docs/release/*` + `docs/review/*` against the branch; fixed only stale facts (drift-proof ahead-count;
security items moved doc→"implemented"; store-readiness Terms code-blocker marked resolved; prod-visible ledger
updated). **No fabricated sign-off.** Verdict: **stay held** — technically merge-ready, commercially scaffolded,
gated on external monetization inputs.

## B — Backend security hardening (`5f3d1b8`, + review hardening `abec400`)
Safe, fail-closed, prod-non-breaking subset (a correctly-configured prod is unaffected):
- **JWT fail-closed** — `JwtKey.ResolveSigningKey` throws outside Development on a secret < 32 bytes (was: silent
  pad → tokens never validate). Dev still pads. Unit-tested.
- **BCrypt 12→13** — adaptive; existing hashes still verify (honest: no rehash-on-login).
- **CORS visibility** — `LogCritical` on empty-`AllowedOrigins` fallback (policy unchanged — deliberate).
- **Mock-billing-in-prod guard** — `LogCritical` if Production runs mock billing / `AcceptSandbox=true`.
- **Documented, NOT changed (with reasons):** Redis rate-limit (needs Redis), HTTPS-redirect / ForwardedHeaders
  (Railway edge-TLS + spoofing vector), device-token attestation, refresh-replay cooldown. See
  `docs/review/security-abuse.md`.

## C — Billing scaffold (`a937d95`)
Vendor-neutral, inactive-by-default. Client: RevenueCat (native) + Stripe (web) stubs that **throw "not
configured"** (never fake success); platform resolver inactive (mock stays the active provider → OFF no-op).
Server (pre-existing, verified): `IBillingVerifier` mock default + `DirectBillingVerifier` (Apple JWS + Google
Play) + idempotent webhooks + server-authoritative `GET /api/entitlements`. **Honest gap surfaced:** web/Stripe
is **unbuilt on the server** (no `SubscriptionStore.Stripe`, no verifier/webhook). Full map + decisions:
`docs/commercial/billing-architecture.md`.

## D — AI scaffold (`c3849ec`)
Vendor-neutral `ICoachAiProvider`: mock default + `CoachAiSettings` config switch + `VendorCoachAiProvider` stub
(faulted task — **never fabricates**) + `CoachAiProviderFactory` (DI delegates; branch unit-tested). Keys are
**server-side only**. Guardrails already enforce honest degraded mode (atomic credit ledger + refund-on-throw,
rate limit, fraud advisory, cost audit). Client + server are mock/demo end-to-end. Map:
`docs/commercial/ai-architecture.md`.

## E — Legal / commercial surfaces (`a0c0ee4`)
`public/terms.html` — a **counsel-owned DRAFT** prominently marked NOT-IN-EFFECT / not-legal-advice, structured
with the platform-required subscription disclosures (auto-renew, cancel, eligibility, refunds, contact);
`[counsel-owned]` markers on liability/governing-law. Linked from PaywallScreen (flag-gated) + ProfileScreen
(**production-visible** → see the merge HARD GATE). Existing disclosures confirmed: auto-renew/cancel fine print,
restore, support/contact, `comingSoon` benefit chips. Tests guard the draft markers + link presence.

## F — Checklists + cost consolidation (`b1ac831`)
New: `docs/release/commercial-readiness.md` (master, READY/PENDING/EXTERNAL per track) +
`docs/release/rollback-recovery.md` (flag kill-switch → revert → restore; additive migrations safe to leave).
Reconciled: deployment-checklist, merge-readiness (added the counsel-Terms HARD GATE), store-readiness,
prod-visible ledger.

## G — Independent review (3 lenses) + resolutions
Read-only review across backend-architecture/data-modeling, frontend/flag-off, and docs-honesty.
**No BLOCKERs; docs verified accurate against code; production OFF no-op confirmed; nothing fakes a
purchase/AI.** Findings resolved in `abec400`: (MAJOR) mock-billing-in-prod fail-loud guard; (MINOR) honest
BCrypt comment; (MINOR) extracted `CoachAiProviderFactory` + 2 tests so the DI selection branch is guarded.

## H — Cost / scalability
`docs/review/cost-scalability.md`: order-of-magnitude ranges at 100/1k/10k/100k users. **$0 commercial cost
today (billing + AI mocked).** Once AI is live it dominates >~1k DAU; the credit policy (free 1 lifetime,
premium 30/mo) is profit-protective by design. DB/connection-pool + Redis are the pre-scale levers (see
backend-readiness). All figures conditional — validate against live dashboards.

## I — Release-readiness checklist
Single source: **`docs/release/commercial-readiness.md`** (+ `v2-merge-readiness.md`, `v2-deployment-checklist.md`,
`rollback-recovery.md`). Net: merge-ready/held; monetization blocked on the EXTERNAL items in K.

## J — Remaining blockers (all EXTERNAL — cannot be done in code)
1. **Billing:** Apple/Google/Stripe accounts + products/price IDs + keys/secrets + webhook URLs; the web/Stripe
   server path is also **PENDING code** (verifier + webhook + `SubscriptionStore.Stripe`).
2. **AI:** vendor account + API key (server env) + spend budget; then implement `VendorCoachAiProvider`.
3. **Legal:** counsel-final Terms/EULA (the draft is a placeholder).
4. **Pricing:** localized prices from live store/Stripe products (replace placeholders).
5. **Decision:** mobile billing via RevenueCat vs the existing direct Apple/Google verifier.
6. **Scale-only:** Redis (multi-instance), Npgsql pool tuning (~1k DAU) — not launch-blocking.

## K — Exact human action list (ordered)
1. **Decide** mobile billing path: RevenueCat (decision-record default) **or** reuse the built-in direct
   Apple/Google verifier (`billing-architecture.md` §"Two honest decisions").
2. **Counsel:** commission final Terms of Service / EULA; replace `apps/poker-mobile/public/terms.html`.
   ⚠ **Required before merge** (it's linked from the production Profile screen).
3. **Billing accounts:** App Store Connect (paid-apps agreement, banking/tax, 2 auto-renew products, ASSN V2 URL
   → `/api/webhooks/apple`, signing key); Google Play (subscription products, RTDN Pub/Sub → `/api/webhooks/google`,
   service-account JSON); if web: Stripe (recurring prices, keys, webhook secret).
4. **Billing config (Railway env):** `BillingSettings__Provider=direct`, `BillingSettings__AcceptSandbox=false`,
   `AppleStoreSettings__RootCertsPem__0`/`BundleIds`, `GooglePlaySettings__PackageName`/`PubSubAudience`/
   `ServiceAccountJson`. (Boot logs now warn if you forget.)
5. **Billing code (PENDING):** implement `revenueCatBillingProvider.ts` / `stripeBillingProvider.ts`; for web add
   `SubscriptionStore.Stripe` + `StripeBillingVerifier` + `/api/webhooks/stripe`; flip `PremiumContext` to
   `resolvePlatformBillingProvider()`; replace placeholder prices with SDK/Stripe prices.
6. **AI:** pick a vendor, get a key + set a budget; set `CoachAiSettings__Provider=vendor` + `CoachAiSettings__ApiKey`
   (server env only); implement `VendorCoachAiProvider.AnalyzeAsync`; flip client `COACH_CONFIG.provider="server"`.
7. **Store submission (EXTERNAL):** Apple Developer enrollment + `eas credentials`; Play Console + service-account;
   metadata/screenshots (`docs/store-release.md`).
8. **Cutover:** create rollback tag + backup branch + DB snapshot (`rollback-recovery.md`); re-run all gates at the
   merge SHA; walk `v2-deployment-checklist.md`; merge `--no-ff`; then flip flags (`paywall`/`coach`/`content`) as
   each capability is genuinely live.
9. **Post-launch hardening:** set `FraudSettings:EnforceBlocking=true` (tuned); add Redis + Npgsql pool tuning as
   you approach ~1k DAU; consider opportunistic BCrypt rehash-on-login.

---
**Bottom line:** the branch is a clean, reviewed, fully-tested merge candidate with honest commercial
foundations. It does **not** ship money or AI until the external accounts/keys/legal in K are in place. Keep the
flags OFF and the branch held until then.
