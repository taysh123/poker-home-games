# Billing Architecture

> **Status: scaffolded, INACTIVE.** The active client billing provider is `mock`; the active server
> verifier is `MockBillingVerifier`. No real purchase can succeed yet, and the `paywall` flag is OFF in
> production. This document is the wiring map + the exact human TODOs to go live. **Nothing here fakes a
> purchase.** Per the commercial decision record: mobile = platform billing (RevenueCat preferred), web =
> Stripe, entitlements server-authoritative.

## Principle: the server is the single source of truth
Entitlement is computed on the server from verified `Subscription` rows and read via `GET /api/entitlements`
(`GetEntitlementQuery` → `IEntitlementService.GetAsync`). The client **never** decides its own tier:
`features/premium/config.ts` sets `SERVER_AUTHORITATIVE = true`, and the on-device entitlement is a
**fail-closed offline cache only** (defaults to `free` on missing/corrupt data — see
`data/entitlementStore.ts` + `premium.test.ts`). A client must never be trusted with tier, price, or receipt
validity.

## What exists today (verified in-tree)

### Client (`apps/poker-mobile/src/features/premium/`)
| Piece | File | State |
|-------|------|-------|
| Vendor-agnostic seam | `types.ts` → `IBillingProvider { getProducts, purchase, restore }` | stable |
| Active provider | `providers/mockBillingProvider.ts` | **mock (default)** — on-device grant, no SDK |
| RevenueCat stub (native) | `providers/revenueCatBillingProvider.ts` | **stub — every method throws "not configured"** |
| Stripe stub (web) | `providers/stripeBillingProvider.ts` | **stub — every method throws "not configured"** |
| Registry + platform resolver | `providers/index.ts` | `getBillingProvider(id='mock')`; `billingProviderIdForPlatform` (web→stripe, native→revenuecat); `resolvePlatformBillingProvider()` — **exported but NOT called on the default path** |
| Entitlement state | `state/PremiumContext.tsx` | calls `getBillingProvider()` (no arg → **mock**) |

The resolver is deliberately inactive: `PremiumContext` calls `getBillingProvider()` with no argument, which
returns the mock, so production behaviour is unchanged. Flipping to real billing is a one-line change in
`PremiumContext` (use `resolvePlatformBillingProvider()`), gated behind real configuration.

### Server (`src/PokerApp.Infrastructure/Billing/`, `.../Features/Billing/`)
The backend is **further along than the client** and already fail-closed:
- `IBillingVerifier.VerifyAsync(store, token) → VerifiedSubscription?` (null ⇒ invalid ⇒ fail-closed). Seam
  comment: "Apple/Google/RevenueCat behind this seam."
- DI switch (`DependencyInjection.cs`): `BillingSettings.Provider = "mock"` (default) → `MockBillingVerifier`;
  `"direct"` → `DirectBillingVerifier` composing **real `AppleBillingVerifier` (App Store JWS) + `GooglePlayBillingVerifier`**.
- `ValidatePurchaseCommand(store, token)` — client-initiated post-purchase validation: verifies the receipt,
  upserts the authoritative `Subscription`, returns `EntitlementDto`. **Validator restricts `store` to
  `apple|google`.**
- `WebhooksController` — Apple ASSN V2 (`/api/webhooks/apple`) + Google Play RTDN via Pub/Sub
  (`/api/webhooks/google`), cryptographically signature-verified (`IStoreNotificationVerifier`), **fail-closed
  (401, no state change) on any bad signature**, processed idempotently + out-of-order-safe by
  `ProcessStoreNotificationCommand`.
- `BillingSettings.AcceptSandbox` — **MUST be `false` in production** so sandbox/TestFlight receipts can never
  grant production entitlements (fail-closed store separation).
- `SubscriptionStore` enum = `{ Apple = 0, Google = 1 }`.

## Two honest decisions before go-live (do NOT skip)

### 1. Mobile: RevenueCat **vs** the already-built direct Apple/Google verifier
The decision record prefers **RevenueCat**, but the server already implements **direct** App Store JWS + Google
Play verification (the `"direct"` provider) — a viable, partially-built alternative. Pick one:
- **(A) RevenueCat** (decision-record default): client uses `react-native-purchases`; add a
  `RevenueCatBillingVerifier : IBillingVerifier` (RevenueCat REST/v2) + a RevenueCat webhook endpoint; select it
  via `BillingSettings.Provider = "revenuecat"`. RevenueCat handles store edge-cases for you; trade-off is a
  third-party dependency + its fee.
- **(B) Direct** (reuse what's built): client uses StoreKit 2 / Play Billing directly (or RevenueCat purely as a
  purchase UI), and the server keeps `DirectBillingVerifier`. No new server verifier; trade-off is owning store
  edge-cases yourself.
Either way the **client seam and the `IBillingVerifier` seam are unchanged** — this is a configuration + which-
adapter decision, not a redesign. Flag this for the owner; it is the one open architectural choice.

### 2. Web: Stripe is entirely unbuilt on the server (real gap)
There is **no Stripe anywhere in the backend** today (`grep` clean; `SubscriptionStore` has no `Stripe` value;
`ValidatePurchaseCommand` rejects non-`apple|google`). Web billing requires NEW server work:
- add `SubscriptionStore.Stripe`;
- add a `StripeBillingVerifier : IBillingVerifier` (verify Checkout session / subscription via Stripe API);
- add `POST /api/webhooks/stripe` verifying the Stripe webhook signature, granting entitlement only from
  `checkout.session.completed` / `customer.subscription.*` (idempotent, like the Apple/Google handlers);
- extend the purchase-validation path to accept the web/Stripe store.
The client `stripeBillingProvider.ts` stub already documents that web entitlement is granted **only** after the
server verifies the webhook — never client-side.

## Flows (target)
- **Purchase (mobile):** paywall → `provider.purchase(productId)` (RevenueCat/StoreKit/Play) → client sends the
  receipt/token to `POST /api/billing/validate` (`ValidatePurchaseCommand`) → server verifies with the store →
  upserts `Subscription` → returns `EntitlementDto`. Store server notifications (`/api/webhooks/*`) keep the
  `Subscription` authoritative for renewals/cancellations/refunds independent of the client.
- **Purchase (web):** paywall → redirect to Stripe Checkout → on return, client refreshes
  `GET /api/entitlements`; entitlement becomes premium **only** once `/api/webhooks/stripe` has verified the
  event server-side.
- **Restore:** mobile → `provider.restore()` (RevenueCat/StoreKit/Play restore) → re-validate server-side. Web →
  re-fetch `GET /api/entitlements` (the server already holds the truth). The mock returns `nothing_to_restore`;
  the stubs throw until configured.
- **Cache refresh:** client refreshes entitlement on app foreground / after purchase / after restore; the cache
  is display-only and fails closed to `free`.

## Trust & fraud boundaries
- **Never trusted from the client:** receipts/tokens (verified server-side), tier, price, `userId` in a body
  (use the auth claim). All currently respected.
- **Sandbox isolation:** `AcceptSandbox=false` in prod (must verify before launch).
- **Fraud:** `FraudSettings.EnforceBlocking` is `false` today (advisory/observability via `IFraudEvaluator` +
  `IAuditLog`); enable blocking once real traffic exists to tune thresholds (don't enable blind).
- **Credits:** AI spend uses the atomic, idempotent `CreditLedger` (refund-on-failure) — see
  `docs/commercial/ai-architecture.md`.

## Exact human TODOs to go live
**Decision first:** choose mobile path (A RevenueCat / B direct) and confirm web = Stripe.

**Mobile (if RevenueCat):**
1. RevenueCat account + project; create entitlements/offerings mapped to products
   `tpoker.premium.monthly` / `tpoker.premium.yearly` (`config.ts`).
2. App Store Connect: paid-apps agreement, banking/tax, the two auto-renewable subscription products,
   App Store Server Notifications V2 URL → `/api/webhooks/apple`, app-specific shared secret / signing key.
3. Google Play Console: subscription products, RTDN Pub/Sub topic → push subscription to `/api/webhooks/google`,
   Play Developer API service account JSON (`GooglePlaySettings.ServiceAccountJson`).
4. Install `react-native-purchases`, set the RevenueCat API key (client) and configure the server verifier;
   set `BillingSettings.Provider` accordingly; implement `revenueCatBillingProvider.ts` against the SDK.
5. Set `BillingSettings.AcceptSandbox=false` in production; populate `AppleStoreSettings.RootCertsPem` +
   `BundleIds` and `GooglePlaySettings.PackageName` + `PubSubAudience`.

**Web (Stripe):**
1. Stripe account; create the two recurring Prices; capture publishable + secret keys + price IDs + webhook
   signing secret.
2. Backend: add `SubscriptionStore.Stripe`, `StripeBillingVerifier`, `POST /api/webhooks/stripe`, and the
   Checkout-session endpoint; wire entitlement grant from the verified webhook only.
3. Client: implement `stripeBillingProvider.ts` against Stripe Checkout; flip the web path via
   `resolvePlatformBillingProvider()`.

**Both:**
- Localized price display comes from the SDK/Stripe at runtime — replace the `config.ts` placeholder strings.
- Flip the `paywall` feature flag ON only after the above + Terms/EULA (`docs/...` / `terms.html`) are in place.

## What is intentionally NOT done (and why)
- **No faked purchases.** The client stubs throw "not configured"; the active provider stays mock; the server
  default verifier is the mock. No code path grants a paid entitlement without real verification.
- **No RevenueCat/Stripe SDK added.** Adding SDKs/keys is owner-gated (accounts + credentials). The seams are in
  place so the swap is contained.
- **`paywall` flag stays OFF.** Premium benefits are still `comingSoon`; charging is blocked until real billing
  + legal land (see `security-abuse.md` "bundled content" decision).
