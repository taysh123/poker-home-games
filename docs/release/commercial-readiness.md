# Commercial Readiness — master checklist

> **Status: HELD. Foundations scaffolded, monetization INACTIVE.** Billing + AI are mock/stub by default,
> the `paywall`/`coach`/`content`/`mastery` flags are OFF, and production is unchanged. This is the single
> entry point that consolidates every commercial/release track and says, for each item, whether it is
> **READY** (done in-repo), **PENDING** (in-repo work remaining), or **EXTERNAL** (needs an account / key /
> counsel — cannot be done in code). Detailed docs are linked per track.

## How to read this
- **READY** — implemented + tested on the held branch; no further code needed.
- **PENDING** — in-repo work that a developer can finish (no external dependency).
- **EXTERNAL** — blocked on an account, key, provider, counsel, or store config. Listed in the final report's
  human action list. We do **not** fabricate these.

## Verdict
The branch is **technically merge-ready with commercial foundations built** (RevenueCat + Stripe verifiers /
webhooks / checkout, the Anthropic AI adapter, server-authoritative entitlements, honest mock-default behavior,
legal placeholders, tests green). It is **NOT monetization-ready** — charging requires the EXTERNAL items below
(Stripe / RevenueCat / Apple / Google accounts + keys + products, the Anthropic key + budget, the
`react-native-purchases` install, and counsel-final Terms). Recommendation: **stay held**; complete EXTERNAL
items, then flip flags.

**Web-first solver (June 2026):** the flagship solver work (canonical solver-pack + import pipeline, the
web-responsive workspace + hover inspector + compare, HTTP security headers, robots/sitemap) is **additive +
flag-gated** (`solver`/`publicSpots` OFF in prod) and **held**. It introduces **no new monetization claims**,
labels illustrative-vs-solver data honestly, and ships no real solver values (EV/equity require an imported
verified pack). See `docs/product/web-first-strategy.md` + the `solver-*` docs. Legal/privacy unchanged
(payments disclosures already present; Terms still counsel-owned DRAFT — the standing pre-merge gate).

## Track index
| Track | Detail doc | Headline |
|-------|-----------|----------|
| Billing | [`commercial/billing-architecture.md`](../commercial/billing-architecture.md) | RevenueCat + Stripe **built (dormant)**; mock default; verifiers + webhooks + checkout fail-closed |
| AI | [`commercial/ai-architecture.md`](../commercial/ai-architecture.md) | **Anthropic adapter built (key-gated)**; mock default; key server-side only |
| Decision record | [`commercial/commercial-decision-record.md`](../commercial/commercial-decision-record.md) | Locked: RevenueCat / Stripe / Anthropic / $11.99 + $99.99 / server-authoritative |
| Legal | this doc + `apps/poker-mobile/public/terms.html` | Privacy live; **Terms = counsel-owned DRAFT** (linked) |
| Backend/infra | [`review/backend-readiness.md`](../review/backend-readiness.md) | Architecture solid; Npgsql pool + Redis are pre-scale gaps |
| Security | [`review/security-abuse.md`](../review/security-abuse.md) | JWT fail-closed + BCrypt13 + CORS visibility **implemented**; Redis/HTTPS-redirect documented |
| Store | [`review/store-readiness.md`](../review/store-readiness.md) | Config submission-ready; Terms code-blocker **resolved**; external accounts/signing remain |
| Cost/scale | [`review/cost-scalability.md`](../review/cost-scalability.md) | AI inference dominates >1k DAU; $0 today (mocked) |
| Merge/deploy | [`v2-merge-readiness.md`](v2-merge-readiness.md) · [`v2-deployment-checklist.md`](v2-deployment-checklist.md) | Clean FF; held by decision |
| Rollback | [`rollback-recovery.md`](rollback-recovery.md) | Additive/flag-gated → reverts cleanly |

## Billing
- **READY (built, dormant):** client seam + mock default (OFF no-op); Stripe (web) adapter wired (key-gated) +
  RevenueCat (native) key-gated stub; server `StripeBillingVerifier` + `RevenueCatBillingVerifier` +
  `DirectBillingVerifier` 4-way dispatch; `/api/webhooks/{stripe,revenuecat}` (signature-verified, fail-closed);
  `POST /api/billing/checkout`; `SubscriptionStore` += Stripe/RevenueCat; server-authoritative
  `GET /api/entitlements`; config placeholders; tests.
- **PENDING (code):** install `react-native-purchases` + implement the documented SDK calls in
  `revenueCatBillingProvider`; flip `PremiumContext` to `resolvePlatformBillingProvider()` at go-live.
- **EXTERNAL:** Apple/Google/Stripe/RevenueCat accounts, products/Price IDs, keys + webhook secrets.

## AI
- **READY (built):** `AnthropicCoachAiProvider` (real Messages API, behind the server key, fail-closed, refunds
  on failure) selected by `CoachAiSettings:Provider=anthropic`; mock default; `CoachAiProviderFactory` switch;
  guardrails (atomic credit ledger + refund, rate limit, fraud advisory, cost audit); tests.
- **PENDING (code):** flip client `COACH_CONFIG.provider="server"`; wire `AiCost` audit to real accounting.
- **EXTERNAL:** Anthropic account + API key (server env only) + spend budget.

## Legal
- **READY:** Privacy Policy (live, `/privacy.html`); Terms DRAFT (`/terms.html`) clearly marked counsel-owned /
  not-in-effect, with the platform-required subscription disclosures structured; Terms linked on Paywall +
  Profile; auto-renew/cancel fine print + restore + support present.
- **EXTERNAL (counsel):** finalize Terms (disclaimers, limitation of liability, governing law, statutory
  cancellation rights) **before any paid subscription**. ⚠ The Terms link is on the production-visible Profile
  screen → finalize before merge (see merge-readiness gate).

## Pricing
- **READY:** provider-driven pricing with `config.ts` fallback (`$11.99`/`$79.99`); economics pinned by tests.
- **PENDING/EXTERNAL:** replace placeholder strings with localized SDK/Stripe prices at runtime (needs live
  products).

## Backend / infra · Security · Store · Cost
See the linked detail docs. Net: **READY** for launch scale with the security subset implemented this program;
**PENDING** = Npgsql pool tuning + Redis (pre-~1k DAU, lowers cost); **EXTERNAL** = store accounts + signing +
service-account key, and (cost) the AI vendor unit price.

## The single gate: before you can charge money
1. EXTERNAL billing (accounts + products + keys + webhooks) **and** the PENDING provider implementations.
2. EXTERNAL AI vendor key + budget **and** the PENDING vendor adapter (only if AI is a paid benefit at launch).
3. Counsel-final Terms/EULA + localized prices.
4. Then: flip `paywall` (+ `coach`/`content` as features go live) and merge per the deployment checklist.

Until all of the above, **keep flags OFF and stay held** — the scaffolding is byte-identical no-op in production.
