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
The branch is **technically merge-ready and commercially scaffolded** (seams, server-authoritative
entitlements, honest demo/stub behavior, legal placeholders, tests green). It is **NOT monetization-ready** —
charging money requires the EXTERNAL items below (store/Stripe accounts + keys + products, an AI vendor key +
budget, and counsel-final legal copy). Recommendation: **stay held**; complete EXTERNAL items, then flip flags.

## Track index
| Track | Detail doc | Headline |
|-------|-----------|----------|
| Billing | [`commercial/billing-architecture.md`](../commercial/billing-architecture.md) | Stubs throw; mock default; server verifier mock\|direct(Apple/Google); **Stripe/web unbuilt** |
| AI | [`commercial/ai-architecture.md`](../commercial/ai-architecture.md) | Mock/demo end-to-end; vendor stub throws; keys server-side only |
| Legal | this doc + `apps/poker-mobile/public/terms.html` | Privacy live; **Terms = counsel-owned DRAFT** (linked) |
| Backend/infra | [`review/backend-readiness.md`](../review/backend-readiness.md) | Architecture solid; Npgsql pool + Redis are pre-scale gaps |
| Security | [`review/security-abuse.md`](../review/security-abuse.md) | JWT fail-closed + BCrypt13 + CORS visibility **implemented**; Redis/HTTPS-redirect documented |
| Store | [`review/store-readiness.md`](../review/store-readiness.md) | Config submission-ready; Terms code-blocker **resolved**; external accounts/signing remain |
| Cost/scale | [`review/cost-scalability.md`](../review/cost-scalability.md) | AI inference dominates >1k DAU; $0 today (mocked) |
| Merge/deploy | [`v2-merge-readiness.md`](v2-merge-readiness.md) · [`v2-deployment-checklist.md`](v2-deployment-checklist.md) | Clean FF; held by decision |
| Rollback | [`rollback-recovery.md`](rollback-recovery.md) | Additive/flag-gated → reverts cleanly |

## Billing
- **READY:** vendor-agnostic client seam (`IBillingProvider`); mock default (OFF no-op); RevenueCat (native) +
  Stripe (web) stubs that throw "not configured" (never fake success); platform resolver (inactive); server
  `IBillingVerifier` (mock default) + `DirectBillingVerifier` (Apple JWS + Google Play) + idempotent webhooks +
  server-authoritative `GET /api/entitlements`; tests.
- **PENDING:** implement `revenueCatBillingProvider`/`stripeBillingProvider` against real SDKs; for web,
  add `SubscriptionStore.Stripe` + `StripeBillingVerifier` + `/api/webhooks/stripe` (does not exist yet);
  flip `PremiumContext` to `resolvePlatformBillingProvider()`.
- **EXTERNAL:** Apple/Google/Stripe accounts, products/price IDs, keys/secrets, webhook URLs; **decision**:
  RevenueCat vs the existing direct Apple/Google verifier (see billing-architecture.md).

## AI
- **READY:** vendor-neutral `ICoachAiProvider` (mock default) + `CoachAiSettings` config switch +
  `VendorCoachAiProvider` stub (throws; never fabricates); guardrails (atomic credit ledger + refund, rate
  limit, fraud advisory, cost audit); client `serverCoachProvider`; tests.
- **PENDING:** implement the real vendor call in `VendorCoachAiProvider`; flip client
  `COACH_CONFIG.provider="server"`; wire `AiCost` audit to real accounting.
- **EXTERNAL:** AI vendor account + API key (server env only) + spend budget.

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
