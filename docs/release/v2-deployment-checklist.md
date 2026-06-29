# V2 Deployment Checklist

> **Reference only — no deploy is performed in this program (Decision 1).** Walk this at the eventual cutover.
> Sourced from `CLAUDE.md` (Deployment section); items marked **(verify)** must be confirmed against the live
> Vercel/Railway dashboards before merge — do not assume.

## Pre-cutover
- [ ] Create rollback target: tag `main` (e.g. `pre-v2-<date>`) + a backup branch (verify remote = source of truth).
- [ ] Confirm final gates green at the merge SHA: `tsc`, `jest`, `expo export -p web`.
- [ ] Review `prod-visible-changes.md` (the live app's appearance will change).
- [ ] Confirm the feature-flag matrix: production env sets no `EXPO_PUBLIC_APP_VARIANT=beta` → all V2 flags OFF.

## Before flipping the `paywall` flag (store IAP compliance — gated)
> Master status: [`commercial-readiness.md`](commercial-readiness.md). Architecture:
> [`commercial/billing-architecture.md`](../commercial/billing-architecture.md),
> [`commercial/ai-architecture.md`](../commercial/ai-architecture.md).
- [x] Terms of Service + Privacy Policy links rendered **on the PaywallScreen** (both linked; Privacy live, Terms is a counsel-owned DRAFT `terms.html`). **EXTERNAL:** counsel must finalize the Terms copy before charging.
- [x] "Cancel anytime" + renewal terms shown near the CTA (present in the paywall fine print).
- [ ] Real billing provider wired behind `IBillingProvider` (RevenueCat/Stripe stubs scaffolded — they throw "not configured"; `mockBillingProvider` is still the active provider; `restore()` is a no-op). **EXTERNAL:** SDK + accounts + keys + products.
- [ ] Localized store pricing (replace hard-coded `$11.99`/`$79.99` with SDK/Stripe-provided prices). **EXTERNAL:** live products.
- [x] Every `PREMIUM_FEATURES` benefit either genuinely live or still flagged `comingSoon` (all `comingSoon` today → won't charge for unshipped benefits). See `docs/design-audit.md`.

## Web → Vercel
- [ ] Root Directory = `apps/poker-mobile` (so `apps/poker-mobile/vercel.json` is the active config; a repo-root one is ignored).
- [ ] Build command = `cd apps/poker-mobile && npx expo export -p web`; Output dir = `apps/poker-mobile/dist`.
- [ ] SPA rewrite present (`/(.*) → /index.html`) so `/join/group/:token` + `/join/session/:token` resolve.
- [ ] Env: `EXPO_PUBLIC_API_URL` = production API URL; `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set.
- [ ] Production domain = `poker-home-games-three.vercel.app` (NOT `t-poker.vercel.app`); privacy at `/privacy.html`.
- [ ] `main` auto-deploys → merging triggers the production web build. **(verify)** dashboard build settings unchanged.

## Backend → Railway
- [ ] Repo-root `Dockerfile` is the build path (Nixpacks auto-detect fails on the monorepo).
- [ ] Env (`__` nested keys): `ASPNETCORE_ENVIRONMENT=Production`, `ConnectionStrings__DefaultConnection`,
      `JwtSettings__SecretKey` (≥64 chars), `JwtSettings__Issuer`, `JwtSettings__Audience`,
      `GoogleSettings__ClientIds__0`, `AllowedOrigins__0=https://poker-home-games-three.vercel.app`,
      `AppSettings__WebBaseUrl=https://poker-home-games-three.vercel.app`.
- [ ] Commercial env — **only when monetizing** (empty ⇒ inert/fail-closed, so safe to leave unset pre-launch):
      `BillingSettings__Provider=direct`, `BillingSettings__AcceptSandbox=false`,
      `StripeSettings__SecretKey/__WebhookSecret/__PriceMonthlyId/__PriceYearlyId`,
      `RevenueCatSettings__SecretApiKey/__WebhookAuthHeader`, `CoachAiSettings__Provider=anthropic` +
      `CoachAiSettings__ApiKey`. Client (Vercel/EAS): `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
      `EXPO_PUBLIC_REVENUECAT_API_KEY`, `EXPO_PUBLIC_PREMIUM_MONTHLY_ID/_YEARLY_ID`. See `commercial-readiness.md`.
- [ ] DB migrations applied (`dotnet ef database update`) — **(verify)** no pending V2 migrations unaccounted for.
      (The Stripe/RevenueCat stores are additive enum values on an int column — **no new migration**.)
- [ ] CORS allow-list includes the Vercel domain (UseCors before exception middleware).

## Post-deploy smoke
- [ ] Web app loads at the production domain; login/register works; an invite deep link resolves.
- [ ] API health: an authed endpoint returns 200; rate-limiter + auth middleware active.
- [ ] Spot-check: with flags OFF, no V2 content/coach/quiz/pack surfaces are reachable (functional parity).
- [ ] Confirm prod-visible visual changes render as intended (per the ledger).

## Rollback
See the dedicated **[`rollback-recovery.md`](rollback-recovery.md)** runbook (flag kill-switch → revert merge →
full restore; additive migrations are safe to leave in place). Quick path: flip flags OFF via config, or
`git revert -m 1 <merge-commit>` → Vercel auto-redeploys.
