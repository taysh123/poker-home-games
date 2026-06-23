# Commercial Decision Record

> **Status: DECIDED + scaffolded, monetization INACTIVE.** This records the locked commercial decisions for
> T Poker and what is ready now vs. blocked on external accounts/keys/legal. Built on held branch
> `feature/v2-poker-platform` (PR #2) — **not merged, not deployed**. Mock providers stay active and the
> `paywall`/`coach` flags stay OFF until the external items below are in place; production is byte-identical.

## Decisions (locked)
| # | Decision | Choice |
|---|----------|--------|
| 1 | Mobile billing | **RevenueCat** on top of the native store rails (App Store / Play) |
| 2 | Web billing | **Stripe** (Checkout + webhooks) |
| 3 | AI vendor | **Anthropic** (Claude Messages API) |
| 4 | Pricing | **$11.99 / month**, **$99.99 / year** (USD; localized price shown at purchase prevails) |
| 5 | Entitlements | **Server-authoritative** — the server computes entitlement from verified subscriptions; the client cache is display-only, fail-closed to free |
| 6 | Secrets | **Never on the client.** Stripe secret, RevenueCat secret, webhook secrets, and the Anthropic key live only in server config/env |
| 7 | Legal | Terms / Privacy / subscription disclosures / restore / support present **before** monetization; counsel must finalize the Terms |
| 8 | Release | **Held** — no merge/deploy until external items land; flags OFF ⇒ production byte-identical |

## Assumptions
- The existing stack stays: .NET 8 on Railway + PostgreSQL, web on Vercel, mobile via EAS. No Supabase, no stack migration.
- Apple/Google subscription products are configured through RevenueCat; the server verifies via RevenueCat (REST + webhook). The pre-existing direct Apple/Google verifier remains available but RevenueCat is the chosen mobile path.
- AI cost is the dominant variable cost once live; the credit policy (free = 1 lifetime, premium = 30/month) caps per-user spend by design.
- Pricing strings in the app are placeholders; the real localized price comes from the store/Stripe at runtime.

## Ready now (built on the branch, inert without credentials)
- **AI (Anthropic):** real `AnthropicCoachAiProvider` (HTTP, behind the server key, fail-closed, refunds on failure); selected by `CoachAiSettings:Provider=anthropic`. Default = mock.
- **Web billing (Stripe):** `StripeBillingVerifier`, `POST /api/webhooks/stripe` (HMAC-verified), `POST /api/billing/checkout`, client Stripe adapter (key-gated). Default = mock.
- **Mobile billing (RevenueCat):** `RevenueCatBillingVerifier`, `POST /api/webhooks/revenuecat` (shared-secret), client adapter (key-gated stub — SDK install deferred). Default = mock.
- **Pricing:** $11.99 / $99.99 in `config.ts` (env-overridable product IDs).
- **Legal:** Privacy (live) + Terms (counsel-owned DRAFT) with subscription disclosures, restore, support, processors named.
- **Config:** placeholder `CoachAiSettings` / `StripeSettings` / `RevenueCatSettings` (empty ⇒ fail closed) + documented env vars.
- Architecture detail: [`billing-architecture.md`](billing-architecture.md), [`ai-architecture.md`](ai-architecture.md). Costs: [`../review/cost-scalability.md`](../review/cost-scalability.md). Release: [`../release/commercial-readiness.md`](../release/commercial-readiness.md).

## External dependencies (genuine blockers — cannot be done in code)
- **Stripe:** account, recurring Prices (monthly/yearly), secret + publishable keys, webhook signing secret.
- **RevenueCat:** account/project, public SDK key, secret REST key, webhook Authorization secret; **install `react-native-purchases`** (native module).
- **Apple/Google:** subscription products + paid-apps agreements; ASSN V2 / RTDN configured (RevenueCat can manage these).
- **Anthropic:** API key + a spend budget.
- **Counsel:** final Terms / EULA (the draft is a placeholder; it's linked from the production Profile screen → finalize before merge).
- **Pricing:** localized price values come from the store/Stripe at runtime.

## Next actions
The exact ordered human action list is in [`../release/final-release-report.md`](../release/final-release-report.md) (§K). In short: open the Stripe / RevenueCat / Anthropic accounts, set the server env keys, install `react-native-purchases`, finalize the Terms, set `BillingSettings:Provider=direct` + `CoachAiSettings:Provider=anthropic`, then flip the flags and merge per the deployment checklist.
