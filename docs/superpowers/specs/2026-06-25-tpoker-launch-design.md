# T Poker — Launch Design (Phase 1 + Phase 2)

> **Status:** APPROVED design spec (brainstorming output). Source of truth for the implementation plans.
> **Date:** 2026-06-25 · **Branch:** `feature/launch-phase-1-2` (worktree, based on `feature/v2-poker-platform`) · **Held — nothing merged without review.**
> **Companion:** `docs/product/business-plan.md` (the *what/why*). This spec is the *how* for Phases 1–2 only.

---

## 1. Context — why this work

T Poker is a two-sided funnel in one Expo (iOS/Android/Web) + ASP.NET Core 8 codebase: a **free home-game
club tool** (the acquisition hook — essentially built and already live as V1) and a **paid poker-training
platform** (the business — heavily built but gated `comingSoon`). This engagement delivers **Phase 1 + Phase 2**
of the business plan as working, tested, shippable software:

- **Phase 1** — finish & ship the free home-game funnel, and wire the **free training taste** (starter
  lessons + daily quiz + limited Spot Trainer) using the already-shipped Calibrated content.
- **Phase 2** — switch on **Premium Study** (full library + all quizzes + unlimited Spot Trainer) behind a
  **server-authoritative** entitlement, with **Stripe web checkout** live and a focused **landing/pricing** page.

It is mostly a *finish-and-switch-on* job: the screens, content, billing seam, and entitlement model already
exist behind feature flags that are OFF in production.

**Absolute invariant — the Honesty Gate:** you never charge for a feature that isn't genuinely live. At launch
the only live paid value is **Premium Study**; everything else renders a "Soon" chip and is never charged. The
`solver` flag stays OFF. (See §10.)

## 2. Decisions locked (from brainstorming)

1. **Free lesson set** = the **4 Core "Free + Premium" packs**: PACK-01 Cash Fundamentals, PACK-05 Push/Fold
   Mastery, PACK-06 MTT Fundamentals, PACK-12 Mental Game Elite. The other **8 packs are Premium**.
2. **Free daily limits** (interactive reps only; lessons in free packs are unmetered): **1 quiz/day** + **3
   Spot Trainer sessions/day**. Premium = unlimited. Limits are **tunable config constants**, enforced
   **client-side** (they meter free content, not revenue).
3. **Landing page** = **two-sided, hook-forward**, single focused web-only page → inline pricing → Stripe CTA,
   with honest "Soon" chips.
4. **Stripe grant** = **webhook (source of truth) + redirect session-verify (fallback)**; hosted Stripe
   Checkout (subscription), **test-mode for the gate**, live-key switch documented.
5. **Money gate is server-authoritative** (the Premium entitlement); **free soft-limits are client-side**.

## 3. Scope & decomposition — 4 independently-shippable subsystems

Each becomes one implementation plan under `docs/superpowers/plans/`, each independently testable.

1. **Funnel finish (P1)** — QA/polish the free home-game product to store-submittable quality; web-verified;
   EAS native build path **documented** (not submitted). Flag flips: `nav5`, `onboardingV2` ON.
2. **Free training taste (P1)** — flags `study`, `content`, `retention` ON (paywall OFF); build free
   daily-limit logic; surface free/premium lock states in Study; verify XP/streak loop consumes study activity.
3. **Paywall + Stripe (P2)** — introduce the live `premium_study` benefit; gate the 8 premium packs +
   unlimited quizzes/trainer behind the server entitlement; wire Stripe checkout + dual grant; honest "Soon"
   chips; fix the `EntitlementService` active-sub-selection bug.
4. **Landing/pricing page (P2)** — web-only, two-sided hook-forward, inline pricing + Stripe CTA.

**Out of scope / "Soon" (honesty gate):** AI Coach, cloud sync, advanced bankroll analytics, solver-verified
GTO, mastery-engine UI, SEO content pages. **PACK-10 "Advanced GTO"** (`ProductionReady: No`) is **excluded
from sold/advertised Premium Study value** until a verified solver run exists (it may exist in-app, clearly
labelled, but is never marketed as paid value).

## 4. Architecture — Free/Premium gating (two dimensions)

**Dimension 1 — content access (pack-level).** Reuse the existing `apps/poker-mobile/src/features/study/logic/
marketableLabel.ts` → `availabilityOf(pack, hasPremium)`. Free = 4 Core packs; Premium = 8. `hasPremium`
derives from the **server-authoritative** `apps/poker-mobile/src/features/premium/entitlementResolve.ts`
(already fail-closed; no anonymous premium). No new mechanism — wire the existing one to the live entitlement
and surface lock states *inside* Study (today they appear only in Pack Catalog).

**Dimension 2 — daily interactive limits (free only).** New, client-side:
- `apps/poker-mobile/src/features/study/config.ts` — `FREE_QUIZ_PER_DAY = 1`, `FREE_TRAINER_SESSIONS_PER_DAY = 3`.
- `apps/poker-mobile/src/features/study/logic/dailyLimits.ts` — **pure** `{counter, todayKey, isPremium} →
  { allowed, remaining }`; premium bypasses.
- `studyStore` — date-stamped daily counter; resets on a new local day.

**Entitlement flow (unchanged, server-authoritative):** client `GET /api/entitlements` → `entitlementResolve`
(server wins; fail-closed to free; no anonymous premium) → `isPremium` drives both dimensions.

**Flag-adaptive nudges (so P1 ships honestly with or without P2):** every "limit reached" / "pack locked"
surface reads the `paywall` flag:
- `paywall` OFF → honest copy ("Daily free limit reached — resets tomorrow. Premium (unlimited) coming soon.")
  with **no purchase path**.
- `paywall` ON → live **Upgrade** CTA → PaywallScreen → Stripe.

**The one live paid benefit:** add `premium_study` to `PREMIUM_FEATURES` (`features/premium/config.ts`) with
`comingSoon: false`. Every other premium feature stays `comingSoon: true`.

## 5. Subsystem 1 — Funnel finish (P1)

Finish/QA only — no new home-game features; settlement engine + money math are **untouched** (pinned by shared
C#↔TS fixtures).

- **Flags:** `nav5` + `onboardingV2` → ON in `src/config/features.ts` `PROD_FLAGS`.
- **Verify** guest → first game (cash + tournament) → invite link → recap/podium share, end-to-end on web
  (Playwright + `expo export` harness).
- **A11y/polish pass** on funnel screens via `ui-ux-pro-max` (close gaps remaining after the prior audit).
- **Document** the EAS native build path (`eas.json` profiles + env) in `docs/release/`.
- **Files:** `config/features.ts`; targeted fixes under `src/screens/*`, `src/features/*`; `docs/release/*`.

## 6. Subsystem 2 — Free training taste (P1)

- **Flags:** `study`, `content`, `retention` → ON (`paywall`, `coach`, `solver`, `mastery` stay OFF).
- **Free-limit logic (TDD):** `features/study/config.ts` (constants) + `features/study/logic/dailyLimits.ts`
  (pure) + `studyStore` daily counter. Wire into `QuizRunnerScreen` (block 2nd quiz/day) and
  `SpotTrainerScreen` (block 4th session/day) with a remaining-count indicator.
- **Content gating in Study:** reuse `availabilityOf`; surface lock states in `LessonModulesScreen` / Study
  home (4 free unlocked, 8 locked). Lock CTAs are **flag-adaptive** (§4). The free **daily quiz draws only
  from free-pack content** (premium-pack quiz categories are locked); Premium unlocks all categories +
  unlimited reps.
- **Engagement loop:** `retention` ON exposes XP/streak/freeze-tokens. Spot-trainer already feeds
  `spotsAnswered`→XP + `studyStreak`. **Verify + add** XP events for **quiz/lesson completion** if missing
  (TDD).
- **Honesty:** with paywall OFF, premium packs are visible-but-locked with "coming soon" — no charge, no fake
  checkout.
- **Verify:** `tsc`, `jest` (dailyLimits + XP wiring), `expo export -p web`; manual web run; reduced-motion + a11y.

## 7. Subsystem 3 — Paywall + Stripe (P2)

**Client:**
- `features/premium/config.ts`: add `premium_study` (`comingSoon:false`) + benefit copy ("Full lesson library
  — all 12 packs · all quizzes · unlimited Spot Trainer"). Others stay Soon.
- `PaywallScreen` (`ui-ux-pro-max`): lead with `premium_study`; "Soon" chips for the rest; monthly/yearly
  toggle (yearly default, "save 30%"); honest price (SDK-localized when available, else $11.99 / $99.99).
  CTA → `PremiumContext.purchase()`.
- `features/premium/providers/stripeBillingProvider.ts` (stub → implement web flow): `purchase()` →
  `monetizationApi.createCheckoutSession()` → redirect to hosted Stripe URL → on `success_url` return run the
  redirect **verify-session** → refresh `GET /api/entitlements`. Web selects Stripe when
  `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` present (else mock stays active — fail-closed).
- Study lock CTAs (built in P1) light up when `paywall` ON.

**Backend (dual grant — webhook source-of-truth + redirect fallback):**
- `StripeCheckoutService` (`src/PokerApp.Infrastructure/Billing/`): create subscription Checkout Session with
  env Price IDs + `success_url` (carrying `session_id`) / `cancel_url` from `AppSettings:WebBaseUrl`.
- **Webhook** `/api/webhooks/stripe`: verify signature (`StripeSignature`/`StripeBillingVerifier`) → on
  `checkout.session.completed` / `customer.subscription.created|updated|deleted` → **idempotently upsert** the
  `Subscription` (store = Stripe). *(Confirm the handler exists from prior work; extend if missing.)*
- **Redirect-verify** `POST /api/billing/verify-session` (or extend existing `validate`): retrieve the Checkout
  Session from Stripe; if paid/active → upsert the same `Subscription` (idempotent with the webhook) → return
  the entitlement (instant unlock).
- **Correctness fix:** `EntitlementService` currently selects the sub with the latest `CurrentPeriodEnd` then
  checks active — an expired sub with a far-future period end can shadow an active one. Filter to active
  candidates (TDD). (From the prior audit backlog; matters now that real subs flow.)
- Server stays authoritative; client is the fail-closed cache.

**Files:** `features/premium/{config.ts, providers/stripeBillingProvider.ts, ui/PaywallScreen.tsx,
state/PremiumContext.tsx}`, `api/monetizationApi.ts`; backend `Billing/StripeCheckoutService.cs`,
the Stripe webhook handler, `BillingController.cs`, `EntitlementService.cs`.

## 8. Subsystem 4 — Landing / pricing page (P2, web-only)

- `src/screens/LandingScreen.tsx` (renders only `Platform.OS === 'web'`): two-sided hook-forward hero →
  club-tool value → "get better between sessions" (Premium Study) → inline pricing cards (monthly/yearly,
  Soon chips) → FAQ → footer (legal links, **18+ / not-a-gambling-product**). Velvet-Table tokens/brand via
  `ui-ux-pro-max`.
- **Routing:** web `/` → Landing for logged-out visitors; logged-in → app; deep links (`/join/*`) bypass
  Landing. Pricing CTA → if signed in, `purchase()`; if not, sign-up → **pending-checkout-intent stash** →
  resume after auth.
- **Files:** `screens/LandingScreen.tsx`, `navigation/AppNavigator` linking, `utils/pendingCheckout.ts`
  (mirror `utils/pendingInvite.ts`).

## 9. Testing strategy (TDD)

- **Gates (green before any "done"):** `npx tsc --noEmit` · `npx jest` · `dotnet build PokerApp.sln` ·
  `dotnet test` · `npx expo export -p web`.
- **TDD per new logic (red → green → commit):** `dailyLimits.ts`; quiz/lesson XP events; `entitlementResolve`
  `premium_study` cases; backend webhook **idempotency** (duplicate ≠ double-grant), `verify-session` grant,
  `EntitlementService` active-sub fix, checkout-session creation.
- **Untouched:** settlement engine / money math (shared fixtures stay byte-equivalent).
- **Manual/E2E:** web funnel; free-taste limits; **Stripe test-mode purchase via `stripe listen` → unlock**;
  reduced-motion + screen-reader pass on new surfaces.
- **Failures:** `systematic-debugging` (reproduce → isolate → root cause → fix → regression test).

## 10. Honesty gate — turned into a check

- **Exactly one** `comingSoon:false` premium feature: `premium_study`. **A jest test asserts this** (CI guard).
- `solver` OFF; workspace shows illustrative/Calibrated, clearly labelled; no fabricated EV/equity; nothing
  "Solver-Verified" without a recorded run.
- PACK-10 excluded from sold/advertised value until verified.
- Paywall never presents a Soon feature as purchasable; with paywall OFF, locked content shows honest "coming
  soon" + no purchase path.
- Verified-badge gate (≥95% verified/Nash) unchanged.

## 11. Per-surface UX (`ui-ux-pro-max` on every new/changed surface)

Surfaces: Study home / module list / lesson reader / quiz runner / Spot Trainer (lock states + limit
indicators) · paywall · pricing/landing. Enforce the priority order: **a11y** (4.5:1 contrast, focus rings,
`prefers-reduced-motion`, SR labels, **never color-only** — critical for quiz/spot feedback + lock states) →
**touch** (≥44×44, ≥8px, loading feedback on checkout) → **perf** (CLS<0.1, reserve space, lazy) → **style**
(Velvet Table; **SVG icons, no emoji**) → **layout** (mobile-first; bottom nav ≤5; no horizontal scroll) →
**semantic tokens only (no raw hex)** → **motion** (150–300ms, meaningful) → **forms** (visible labels, errors
near field). Reuse `components/Avatar.tsx`, existing tokens/primitives/motion, one consistent "Soon"
chip + lock affordance across Study/paywall/landing. Brand: DM Serif Display / Sora / Inter, deep-navy +
restrained gold, T Poker logo anchor; the landing must read as the same product.

## 12. Human actions (documented; test-mode for the gate)

- **Stripe dashboard:** create the Product + **monthly & yearly Prices** → capture `price_…` IDs; obtain
  **publishable + secret keys + webhook signing secret** (test mode).
- **Env:** backend (Railway) `StripeSettings__SecretKey/__WebhookSecret/__PriceMonthlyId/__PriceYearlyId` +
  `AppSettings__WebBaseUrl`; client (Vercel) `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (+ `EXPO_PUBLIC_PREMIUM_*_ID`
  if overriding defaults). **Test → live-key switch documented**, never committed.
- (Optional, when shipping to stores) Apple Developer $99/yr, Google Play $25 one-time — only if/when EAS store
  builds are pursued.

## 13. Rollout / safety

- All work in the worktree on `feature/launch-phase-1-2`; **nothing merged without review**.
- Flags allow shipping **P1 alone** (paywall OFF) or **P1+P2 together** (paywall ON) — same code, honest in both.
- Prod-visible changes (flag flips, new surfaces) ledgered in `docs/release/prod-visible-changes.md`;
  reversible by flag.
- Git Safety Protocol in force: no force-push/reset/branch-delete/history-rewrite; backup branch
  `backup/pre-launch-20260624` pushed.

## 14. Future (noted, NOT built — YAGNI / honesty)

Analytics **provider** wiring for activation/retention metrics (instrumentation exists; needs an account/key —
a human action); server-side hardening of free daily limits; AI Coach (Phase 4); cloud sync; advanced bankroll
analytics; solver-verified GTO (Phase 4, after written redistribution rights); mastery-engine UI; SEO content
surface (Phase 3).

## 15. Success criteria (definition of done for this engagement)

- Phase 1: free home-game funnel finished to store-submittable quality (web-verified; EAS path documented);
  free training taste (4 free packs + 1 quiz/day + 3 trainer sessions/day) live and wired to XP/streak.
- Phase 2: Premium Study gated behind a server-authoritative entitlement; paywall presents only live value with
  honest "Soon" chips; Stripe web checkout works end-to-end in test mode (live-key switch documented); branded
  landing/pricing page ships on web.
- All gates green (`tsc`, `jest`, `dotnet build`, `dotnet test`, `expo export -p web`); new logic TDD-covered;
  reviewed at each task gate; branch finished and merge-ready.
- Honesty-gate confirmation: zero paid features in `comingSoon` except the live `premium_study`; `solver` OFF.
