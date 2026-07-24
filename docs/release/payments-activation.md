# Turning Premium ON — Payments Activation Checklist

> **Status: NOT STARTED. This is the plan for later.** Nothing in T Poker is purchasable today,
> by design (free-first launch). This document is the complete, code-grounded checklist for
> activating paid premium via **Apple App Store** and **Google Play** in-app purchases (IAP),
> with **RevenueCat** as the client purchase layer. Read §1 first — a lot is already built, so
> "activation" is mostly configuration + store paperwork + a careful honesty flip, not new
> architecture.
>
> Written 2026-07-23 against the live codebase. Re-verify file/line references before executing —
> code moves.

---

## 0. Who does what (so nothing falls between stools)

| Track | Owner | Blocking? |
|---|---|---|
| Store paperwork (agreements, banking, tax) | You + accountant | **Yes** — Apple/Google won't show a price until this is done |
| Create IAP products in ASC / Play Console | You | Yes |
| RevenueCat account + dashboard config | You | Yes |
| Backend credentials (Railway env) | You (values) + me (verify wiring) | Yes |
| Client SDK install + provider implementation | Me | Yes |
| Honesty-config flip + test-pin rewrite | Me | Yes (do LAST) |
| First-purchase + refund verification | You (device) + me (checks) | Yes — gate before public launch |

**The one rule that governs the order:** the **backend must be able to verify a real receipt and
grant an entitlement BEFORE any client shows a Buy button.** If the paywall goes live before the
server can validate, real purchases fail validation (HTTP 400) and you take money you can't honor.
Everything in §5 is sequenced around that rule.

---

## 1. What already exists (so you know what you're NOT paying to build)

The billing **seam is substantially implemented on both tiers** and is deliberately inert. You are
activating it, not building it.

**Backend (`src/`) — real, not stubs:**
- `IBillingVerifier` (`PokerApp.Application/Common/Interfaces/IBillingVerifier.cs`) → `VerifyAsync(store, token)` returns a `VerifiedSubscription?` (null = invalid, fail-closed by contract).
- `DirectBillingVerifier` dispatches by store to per-store verifiers that already exist: **Apple** (StoreKit2 signed-JWS validation), **Google Play** (OIDC/service-account), plus RevenueCat / Stripe / Paddle.
- Grant paths: `POST /api/billing/validate` (client sends a receipt → verify → upsert `Subscription` → return recomputed entitlement — **this is the mobile IAP path** the RevenueCat flow uses), `POST /api/billing/verify-session` (a Paddle **web** redirect fast-path — NOT exercised by the mobile flow), and signature-verified store webhooks at `/api/webhooks/{apple|google|revenuecat|…}`.
- Server-authoritative entitlement: the `Subscription` entity + `EntitlementService` decide premium; `GET /api/entitlements` reads it back. Sandbox subs grant nothing unless `AcceptSandbox=true`.

**Frontend (`apps/poker-mobile/`):**
- `EntitlementsContext` — server-authoritative, **fail-closed** (any error ⇒ falls back to cache, never invents premium). Cache key `tpoker.entitlement.v1`.
- `features/premium/config.ts` — the honesty config: `PRICING` already defines product IDs `tpoker.premium.monthly` ($8.99) and `tpoker.premium.yearly` ($79.99); `PREMIUM_FEATURES` (all `comingSoon: true`); `BILLING_KEYS` (all empty).
- `features/premium/providers/` — a vendor-neutral `IBillingProvider` seam. `revenueCatBillingProvider.ts` is a **throwing stub** (`NOT_CONFIGURED`) because `react-native-purchases` is intentionally not installed yet.
- `PaywallScreen` + `LockNudge` — render inert "Coming soon" copy with **no CTA** while the `paywall` flag is off.

**Why it's OFF today (all must flip together — §5/§6):**
- `config/features.ts` → `PROD_FLAGS.paywall = false`.
- `features/premium/config.ts` → all four `PREMIUM_FEATURES` are `comingSoon: true` ⇒ `liveFeatureKeys()` is `[]`.
- Prod backend: `appsettings.Production.json` pins `BillingSettings.Provider = "direct"` + `AcceptSandbox = false`, and **every store verifier has empty credentials**, so any receipt fails closed (400). *(Note: prod does NOT use `DisabledBillingVerifier` — it runs `DirectBillingVerifier` with empty creds. Activation = supply credentials, not swap the verifier.)*
- The four legal pages (`public/{terms,privacy,pricing,refund}.html`) state nothing is purchasable and name no live web processor.

### RevenueCat vs. direct verification — a decision to make first
The backend **already verifies Apple/Google receipts directly** (no RevenueCat needed on the server).
RevenueCat is a **client-side convenience layer** (unified purchase API, subscription state, easier
cross-platform) plus an optional server verification path. You asked for the RevenueCat path, so this
doc wires it — but know the alternative:

- **RevenueCat path (this doc):** client uses `react-native-purchases`; RevenueCat is the source of
  truth for purchase state; backend verifies via `RevenueCatBillingVerifier` (REST + secret key) and/or
  the RevenueCat webhook. Fastest to a working cross-platform paywall.
- **Direct path (already built, no vendor):** client uses `expo-in-app-purchases`/StoreKit directly;
  backend verifies via the existing Apple/Google verifiers. No RevenueCat fees, more client code.

Either way, keep `BillingSettings.Provider = "direct"` in prod (the dispatcher) — "direct" refers to
our dispatcher, and it already routes to a `revenuecat` sub-verifier. Do **not** set `Provider = mock`
in production (that's what `BillingFailClosedProdTests` guards).

---

## 2. Apple — App Store Connect (this is most of the accountant conversation)

### 2.1 Agreements, Tax, and Banking (ASC → Business / Agreements, Tax, and Banking)
Premium won't display a price until the **Paid Applications Agreement** is active. Since we ship under
the owner's **individual** developer account (legal name **Tay Shofer**), the tax/banking identity is
personal, not a company.

- [ ] **Accept the Paid Applications Agreement** (Account Holder only).
- [ ] **Banking:** add a bank account for payouts (name must match the account holder). Apple pays
      ~monthly, ~33 days after month-end, above a minimum threshold.
- [ ] **Tax forms:** complete the tax questionnaires Apple requires for your regions — for a US
      individual that's typically a **W-9**; for a non-US individual a **W-8BEN**. Apple also has
      per-territory tax forms (e.g. Japan, Australia, Canada, Korea, EU/UK VAT). The accountant should
      confirm which territories you sell in and which forms apply.
- [ ] **Enroll in the App Store Small Business Program** if eligible (< $1M/yr) → **15%** commission
      instead of 30%. This is a simple opt-in and worth doing before first sale.

**Accountant-relevant mechanics (bring these to the meeting):**
- **Apple is the Merchant of Record.** Apple sells to the customer, collects and **remits VAT / sales
  tax / GST** in most jurisdictions, and pays you the net. You generally do **not** file sales tax /
  VAT per-country for IAP — but confirm your **home-country income tax** treatment of the net payouts.
- **Commission:** 15% (Small Business Program) or 30% off the customer price; Apple already deducts it
  from your payout. Your revenue = customer price − Apple commission − any taxes Apple withholds.
- **Reporting:** payouts are reported to you (and, for US persons, may generate a **1099-K** from
  Apple depending on thresholds). Keep the monthly financial reports for the accountant.
- **Refunds:** Apple can refund a customer unilaterally; the amount is clawed back from a later payout.
  Budget for a small refund rate.

### 2.2 Create the IAP products (ASC → your app → Monetization / In-App Purchases + Subscriptions)
Match the product IDs the code already expects (`config.ts` `PRICING`): `tpoker.premium.monthly`,
`tpoker.premium.yearly`. (These are env-overridable via `EXPO_PUBLIC_PREMIUM_MONTHLY_ID` / `_YEARLY_ID`
and the backend `*PriceMonthlyId`/`*PriceYearlyId`, but matching the defaults is simplest.)

- [ ] Create an **Auto-Renewable Subscription Group** (e.g. "T Poker Premium").
- [ ] Add two subscriptions in that group: monthly `tpoker.premium.monthly` and yearly
      `tpoker.premium.yearly`, so users can switch tiers within the group (upgrade/downgrade proration
      is handled by Apple within a group).
- [ ] Set prices (price tiers per territory), localized display name + description, and a review
      screenshot for each.
- [ ] Fill the **subscription-group localization** and the app's **subscription terms** (auto-renew
      disclosure) — required for review.
- [ ] If you use the **App Store Server API / Server Notifications v2** (e.g. via RevenueCat), generate
      the key and note the **Issuer ID** + **Key ID** — but these live on the **RevenueCat / store
      side**, not as backend Railway env vars. Our backend's Apple verifier consumes only
      `AppleStoreSettings__RootCertsPem__0` + `__BundleIds__0` (it validates the StoreKit2 JWS against
      the Apple root cert); there is no App-Store-Server-API-key slot in `BillingSettings`.
- [ ] Configure **App Store Server Notifications v2** URL → `https://<api>/api/webhooks/apple`.

---

## 3. Google Play (Android)

- [ ] **Payments profile:** Play Console → set up a merchant/payments profile (tax + banking), same
      individual identity (Tay Shofer). Google is also **Merchant of Record** (remits VAT/GST/sales tax
      like Apple), 15%/30% commission (15% on the first $1M/yr automatically).
- [ ] **Create the products:** Monetize → Subscriptions → create `tpoker.premium.monthly` /
      `tpoker.premium.yearly` (base plans + offers), matching the IDs above.
- [ ] **Service account for server verification:** Google Cloud → create a service account with
      *Android Publisher* access, grant it in Play Console (Financial data / Manage orders), download
      the JSON → this becomes the backend `GooglePlaySettings__ServiceAccountJson`.
- [ ] **Real-time developer notifications (RTDN):** create a Pub/Sub topic, point Play to it, and set
      the backend `GooglePlaySettings__PubSubAudience` → webhook `/api/webhooks/google`.
- [ ] Package name is already `com.tpoker.app` (`GooglePlaySettings__PackageName`).

---

## 4. RevenueCat wiring (client purchase layer)

RevenueCat sits between the app and the stores. Do the dashboard setup first, then the code.

### 4.1 RevenueCat dashboard
- [ ] Create a RevenueCat project; add the **iOS app** (bundle `com.tpoker.app`, App Store shared
      secret / In-App Purchase key) and the **Android app** (package `com.tpoker.app`, Play service
      account JSON).
- [ ] Create an **Entitlement** named `premium` (this is what the app checks).
- [ ] Create **Products** `tpoker.premium.monthly` / `tpoker.premium.yearly`, attach them to an
      **Offering**, and map both to the `premium` entitlement.
- [ ] Copy the **public SDK keys** (one per platform) and the **secret API key** (server) and the
      **webhook auth header** value.

### 4.2 Client code (`apps/poker-mobile/`)
- [ ] `npm i react-native-purchases` (it's intentionally absent today — see
      `features/premium/providers/revenueCatBillingProvider.ts` header). Rebuild a dev client (native
      module → not Expo Go).
- [ ] Implement the throwing stub `revenueCatBillingProvider.ts` against the SDK: `configure(apiKey)`,
      `getOfferings()`, `purchasePackage()`, `restorePurchases()`, and map RevenueCat's `premium`
      entitlement → our `IBillingProvider` result. Keep the vendor-neutral shape so
      `resolveActiveBillingProvider()` (`providers/index.ts`) selects it when the key is present.
- [ ] Set env: `EXPO_PUBLIC_REVENUECAT_API_KEY` (the public key; wire iOS/Android keys as needed) and,
      if not using the code defaults, `EXPO_PUBLIC_PREMIUM_MONTHLY_ID` / `_YEARLY_ID`. Add these to the
      **EAS build profiles** (`eas.json` `env`), not just `.env` — production reads from EAS.
- [ ] On successful purchase, the client still calls our `POST /api/billing/validate` with the receipt
      (store `revenuecat`) so the **server** is the entitlement authority — never trust the client.

### 4.3 Backend credentials (Railway env — values from you, wiring already exists)
Keep `BillingSettings__Provider = "direct"`, `BillingSettings__AcceptSandbox = false` in prod. Add:
- Apple: `AppleStoreSettings__RootCertsPem__0` (Apple root cert PEM) + `AppleStoreSettings__BundleIds__0`
  (already `com.tpoker.app`) — these are the ONLY Apple backend credentials; any App Store Server API
  key/issuer is configured on the RevenueCat/store side, not here.
- Google: `GooglePlaySettings__ServiceAccountJson`, `GooglePlaySettings__PackageName` (`com.tpoker.app`),
  `GooglePlaySettings__PubSubAudience`.
- RevenueCat: `RevenueCatSettings__SecretApiKey`, `RevenueCatSettings__WebhookAuthHeader`.
- Point each store's server notifications at the matching `/api/webhooks/*` endpoint.

**Do NOT** configure the Stripe/Paddle web verifiers — web payments are dead (Paddle rejected poker),
and the legal pages/tests forbid presenting them as live. Leave those credentials empty.

---

## 5. Activation order (the safe sequence — do NOT reorder)

1. **Stores + RevenueCat set up** (§2–§4.1). No app change yet; nothing is live.
2. **Backend credentials deployed** (§4.3) with `Provider=direct`, `AcceptSandbox=false`. The server can
   now verify real production receipts — but no client can buy yet. Confirm `GET /api/entitlements`
   still returns `free` for everyone and `BillingFailClosedProdTests` is still green.
3. **Sandbox-verify the backend** in a **non-production** environment with `AcceptSandbox=true` (never in
   prod): push a sandbox receipt through `POST /api/billing/validate`, confirm a `Subscription` row is
   created and `GET /api/entitlements` returns `premium`. Revert the sandbox env.
4. **Client SDK + provider** shipped to **TestFlight / Play internal track** (§4.2), paywall still OFF in
   that build's flags OR flipped only for the test track. Do a **real sandbox purchase** end-to-end.
5. **The honesty flip** (§6) — one PR, all pins together — enabling the paywall and marking the going-live
   features `comingSoon: false`. Ship to TestFlight/internal FIRST, verify (§7), then production.
6. **Production rollout** — flip `PROD_FLAGS.paywall = true`, submit the build, and only after §7 passes
   on a real production purchase do you announce it.

---

## 6. The honesty flip — exact files + pins (all in ONE change)

Turning premium on means editing these together, or CI blocks you (by design). From the honesty-pin map:

**Config to change:**
- `apps/poker-mobile/src/config/features.ts` → `PROD_FLAGS.paywall = true` (and beta if desired).
- `apps/poker-mobile/src/features/premium/config.ts` → set `comingSoon: false` on **only** the
  `PREMIUM_FEATURES` entries that are genuinely live (e.g. `premium_study`, `cloud_sync`,
  `advanced_bankroll`). **`ai_coach` stays `comingSoon: true` until the Coach actually makes real API
  calls** — do not flip it just because billing is on.

**Tests/pins to rewrite in the same PR:**
- `features/premium/__tests__/honesty.test.ts` — currently asserts **zero** `comingSoon:false` features
  and every feature `comingSoon:true`. Relax to allow exactly the live set.
- `features/premium/__tests__/paywallContent.test.ts` — currently `liveFeatureKeys()` must equal `[]`.
  Update to the live keys.
- `config/__tests__/features.test.ts` — add `'paywall'` to `expectedOn`.
- `config/__tests__/features.prodFlags.test.ts` — a **separate** guard that asserts
  `PROD_FLAGS.paywall === false` (plus coach/solver/mastery). Relax the `paywall` assertion in the
  same PR, or the paywall flip turns this suite red too.
- `features/premium/__tests__/legalSurfaces.test.ts` — the four HTML pages must change from
  "nothing purchasable / no checkout / `$0` only / Coming soon" to live pricing + purchase language.
  **Keep** the bans on Paddle/Stripe/RevenueCat *as live web processors* and the "future billing via
  Apple App Store + Google Play" framing; **keep** publisher = Tay Shofer.
  Rewrite `public/{pricing,terms,refund,privacy}.html` accordingly (pricing gains real plan cards;
  refund/terms describe store-managed refunds/cancellation; privacy's Payments section says purchases
  are processed by the app stores — it already does).

**The marketing site (`apps/landing/`) has its OWN honesty gate — activate it in the same effort:**
Turning premium on is not just the mobile app. The standalone Next.js site has a parallel honesty model:
- `apps/landing/lib/features.ts` (its own `PREMIUM_FEATURES` with `.live` / `buyHref`) and
  `apps/landing/lib/stores.ts` (`STORE_BADGES` with `href`).
- `apps/landing/__tests__/honesty.test.ts` — pins **zero** live features, **no** `buyHref` on any
  feature, and **no** `href` on any store badge. Update when the site shows pricing + real App Store /
  Play download links.
- `apps/landing/__tests__/positioning.test.ts` — pins that `PRICING` carries no numeric price and no
  copy quotes a subscription price. Update when you publish prices.
- **Cross-app coupling:** `positioning.test.ts` also reads `apps/poker-mobile/public/pricing.html` and
  asserts every landing free-plan bullet appears in it — so the `pricing.html` rewrite above can break
  the *landing* suite if any free-plan bullet text changes. Change them together.

If you skip the landing site, the public marketing page keeps saying "coming soon" with dead (hrefless)
store badges while the app charges — a public honesty contradiction.

**Backend pin that must stay GREEN (do not weaken):**
- `src/PokerApp.Tests/BillingFailClosedProdTests.cs` — keeps asserting prod `Provider="direct"` +
  `AcceptSandbox=false`. Activation supplies **credentials via env**, so this test is unaffected. If it
  ever needs changing, you're doing something wrong (e.g. setting `Provider=mock` in prod).

**Product-vision docs to update:** `CLAUDE.md` (launch-status paragraph), `docs/store-release.md`
(reviewer note currently says "no in-app purchases … every feature is free" — that must change and the
listing must add IAP disclosure), and the App Privacy / Data Safety forms (declare "Purchases").

---

## 7. First real purchase + refund verification pass

Do this on TestFlight/internal first, then repeat once on production before announcing.

**Purchase:**
1. Sign in on a real device from the store build. Buy `tpoker.premium.monthly` with a **sandbox tester**
   (Apple) / **license tester** (Google).
2. Confirm the client received the purchase AND that `POST /api/billing/validate` returned success and a
   `Subscription` row exists server-side.
3. Confirm `GET /api/entitlements` returns `premium` and the app **unlocks the live features** (and the
   `LockNudge`/paywall no longer gates them). Kill and relaunch — entitlement persists (cache
   `tpoker.entitlement.v1`) and re-verifies on next `/entitlements` fetch.
4. Confirm **Restore Purchases** re-grants on a fresh install / second device.

**Refund / revocation (the part people skip):**
5. Issue a refund (Apple: request via sandbox/App Store; Google: Play Console refund) OR let the sub
   lapse.
6. Confirm the store **webhook** hits `/api/webhooks/{apple|google|revenuecat}`, the `Subscription`
   status transitions (Canceled/Expired), and after `CurrentPeriodEnd` `GET /api/entitlements` returns
   **`free`** again — the app **re-locks** premium. This closes the loop: you must be able to take
   premium away, not just grant it.

**Edge checks:**
7. Sandbox receipt against **production** config ⇒ must be rejected (`AcceptSandbox=false`).
8. Hijack resistance on the RevenueCat/Apple/Google `validate` path comes from the receipt being a
   **private, account-bound token**: the server binds the resulting `Subscription` to the
   authenticated caller, and `VerifiedSubscription.AppUserId` is null by design for these stores (no
   `app_user_id` comparison happens). The explicit `app_user_id != caller` rejection pinned by
   `SecurityBillingBindingTests` is **Paddle-web-specific** and is NOT exercised by the mobile IAP flow —
   don't rely on it for RevenueCat.
9. Expired/malformed receipt ⇒ 400, no entitlement.

**Rollback:** if verification fails at any step, flip `PROD_FLAGS.paywall = false` (and revert the
`comingSoon` flags) and redeploy — the seam returns to inert "Coming soon" with no charge path. Because
entitlement is server-authoritative and fail-closed, pulling the paywall never strands a paid user's
access (their `Subscription` row still grants premium until it expires).

---

## 8. Go / No-Go gate (one page before flipping prod)

- [ ] Paid Apps Agreement active; banking + tax forms complete (accountant signed off).
- [ ] IAP products live in ASC **and** Play, IDs = `tpoker.premium.monthly` / `.yearly`.
- [ ] RevenueCat entitlement `premium` maps both products on both platforms.
- [ ] Backend creds deployed; `Provider=direct`, `AcceptSandbox=false`; `BillingFailClosedProdTests` green.
- [ ] Store webhooks reach `/api/webhooks/*` and update `Subscription` status (verified with a real event).
- [ ] Client SDK installed; a **sandbox purchase** grants premium and a **refund revokes** it (§7) on
      TestFlight/internal.
- [ ] Honesty flip PR merged: paywall on, live `comingSoon:false` set correct, `ai_coach` still off,
      legal pages + all four honesty tests rewritten, store listing + privacy forms updated.
- [ ] One **production** purchase + refund verified before public announcement.

---

### Appendix — key files (verify before executing; code moves)
- Backend seam: `IBillingVerifier.cs`, `DirectBillingVerifier.cs`, `BillingVerifierSelection.cs`,
  `BillingSettings.cs`, `EntitlementService.cs`, `Subscription.cs`, `BillingController.cs`,
  `WebhooksController.cs`, `appsettings.Production.json`.
- Backend pins: `src/PokerApp.Tests/BillingFailClosedProdTests.cs`,
  `SecurityBillingBindingTests.cs`, `SecuritySandboxEntitlementTests.cs`.
- Frontend seam: `context/EntitlementsContext.tsx`, `features/premium/config.ts`,
  `features/premium/entitlementResolve.ts`, `features/premium/providers/` (esp.
  `revenueCatBillingProvider.ts`, `index.ts`), `features/premium/triggers.ts`,
  `features/premium/ui/PaywallScreen.tsx`, `features/study/ui/LockNudge.tsx`,
  `config/features.ts`.
- Frontend pins: `features/premium/__tests__/{honesty,paywallContent,legalSurfaces}.test.ts`,
  `config/__tests__/features.test.ts`, `config/__tests__/features.prodFlags.test.ts`, and
  `public/{pricing,terms,refund,privacy}.html`.
- Marketing site: `apps/landing/lib/{features,stores}.ts`,
  `apps/landing/__tests__/{honesty,positioning}.test.ts` (positioning also reads
  `apps/poker-mobile/public/pricing.html`).
