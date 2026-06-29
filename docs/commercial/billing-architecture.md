# Billing Architecture

> **Status: RevenueCat + Stripe BUILT, INACTIVE (mock by default).** Decisions are locked: mobile = RevenueCat,
> web = Stripe, entitlements server-authoritative (see `commercial-decision-record.md`). The server verifiers +
> webhooks for both are implemented but **config-gated + fail-closed** — with empty settings the active verifier
> stays `MockBillingVerifier`, the client active provider stays `mock`, and the `paywall` flag is OFF, so
> production is unchanged. **Nothing here fakes a purchase.** The remaining blockers are external accounts/keys
> (+ the `react-native-purchases` install for mobile).

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
| RevenueCat (native) | `providers/revenueCatBillingProvider.ts` | **key-gated stub** — throws "not configured" (`react-native-purchases` install deferred); exact SDK + `validatePurchase('revenuecat', …)` steps documented inline |
| Stripe (web) | `providers/stripeBillingProvider.ts` | **wired, key-gated** — with `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`: server Checkout (`createCheckoutSession`) → open → re-read entitlement; throws "not configured" when empty |
| Server API | `api/monetizationApi.ts` | `createCheckoutSession` (POST `/api/billing/checkout`) + `validatePurchase` (POST `/api/billing/validate`) + `getEntitlements` |
| Registry + platform resolver | `providers/index.ts` | `getBillingProvider(id='mock')`; `billingProviderIdForPlatform` (web→stripe, native→revenuecat); `resolvePlatformBillingProvider()` — **exported but NOT called on the default path** |
| Entitlement state | `state/PremiumContext.tsx` | calls `getBillingProvider()` (no arg → **mock**) |

The resolver is deliberately inactive: `PremiumContext` calls `getBillingProvider()` with no argument, which
returns the mock, so production behaviour is unchanged. Flipping to real billing is a one-line change in
`PremiumContext` (use `resolvePlatformBillingProvider()`), gated behind real configuration.

### Server (`src/PokerApp.Infrastructure/Billing/`, `.../Features/Billing/`)
Fail-closed; all provider-gated:
- `IBillingVerifier.VerifyAsync(store, token) → VerifiedSubscription?` (null ⇒ invalid ⇒ fail-closed).
- DI switch (`DependencyInjection.cs`): `BillingSettings.Provider = "mock"` (default) → `MockBillingVerifier`;
  `"direct"` → `DirectBillingVerifier` dispatching by store to **`AppleBillingVerifier` (JWS) +
  `GooglePlayBillingVerifier` + `StripeBillingVerifier` + `RevenueCatBillingVerifier`**. The Stripe/RevenueCat
  verifiers return null when their settings are empty.
- `SubscriptionStore` enum = `{ Apple, Google, Stripe, RevenueCat }` (int-stored — **no migration**).
  `SubscriptionStoreParser` is the single store-string mapper; `ValidatePurchaseCommand` + `RedeemTopUp` accept
  all four.
- Webhooks (`WebhooksController` + `IStoreNotificationVerifier`) — all signature-verified, fail-closed (401),
  idempotent (`StoreWebhookEvent` dedup), out-of-order-safe (`ProcessStoreNotificationCommand`):
  `/api/webhooks/apple` (ASSN V2 JWS), `/api/webhooks/google` (RTDN OIDC),
  `/api/webhooks/stripe` (raw body + `Stripe-Signature` HMAC via `StripeSignature.Verify`),
  `/api/webhooks/revenuecat` (raw body + shared Authorization secret).
- `POST /api/billing/checkout` (`CreateCheckoutSessionCommand` → `IStripeCheckoutService`) creates a Stripe
  Checkout session; BadRequest when unconfigured. Success/cancel URLs from `IWebSettings` (not hardcoded).
- `BillingSettings.AcceptSandbox` — **MUST be `false` in production**. A startup `LogCritical` warns if prod runs
  the mock verifier or accepts sandbox.

## Decisions (resolved)
- **Mobile = RevenueCat** (on the native store rails). Server verifies via `RevenueCatBillingVerifier` (REST
  subscriber lookup) + `/api/webhooks/revenuecat`. The direct Apple/Google verifier remains available as a
  fallback, but RevenueCat is the chosen path. Remaining external step: RevenueCat account/keys + installing
  `react-native-purchases` (native module — deferred; the client adapter is a key-gated stub with the exact SDK
  calls documented inline).
- **Web = Stripe.** Built: `StripeBillingVerifier`, `/api/webhooks/stripe` (HMAC), `POST /api/billing/checkout`,
  and the client adapter. Remaining external step: Stripe account/keys/Price IDs/webhook secret.

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
**Mobile (RevenueCat):**
1. RevenueCat account + project; entitlements/offerings mapped to the products (`config.ts` IDs, env-overridable).
2. App Store Connect + Google Play: the two auto-renew subscription products + paid-apps agreements; let
   RevenueCat manage the store notifications (ASSN V2 / RTDN), and configure the RevenueCat →
   `/api/webhooks/revenuecat` webhook (set `RevenueCatSettings__WebhookAuthHeader`).
3. Set env: `EXPO_PUBLIC_REVENUECAT_API_KEY` (client public key) + `RevenueCatSettings__SecretApiKey` (server).
4. **Install `react-native-purchases`** and implement the documented SDK calls in `revenueCatBillingProvider.ts`.

**Web (Stripe):**
1. Stripe account; two recurring Prices; capture publishable + secret keys + Price IDs + webhook signing secret.
2. Set env: `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client) + `StripeSettings__SecretKey`/`__WebhookSecret`/
   `__PriceMonthlyId`/`__PriceYearlyId` (server); point the Stripe webhook at `/api/webhooks/stripe`.

**Both:**
1. Set `BillingSettings__Provider=direct` + `BillingSettings__AcceptSandbox=false`; set `AppSettings__WebBaseUrl`
   (Checkout success/cancel URLs).
2. Localized price display comes from the SDK/Stripe at runtime — the `config.ts` strings are placeholders.
3. Flip `paywall` ON only after the above + counsel-final Terms (`terms.html`) are in place.

## What is intentionally NOT done (and why)
- **No faked purchases.** With empty settings every verifier returns null / checkout 400s; the active verifier
  stays mock; the client active provider stays mock. No path grants a paid entitlement without real verification.
- **No vendor SDKs added.** Stripe + RevenueCat server verification is hand-rolled HTTP (consistent with the
  existing Apple JWS / Google OIDC verifiers); the native `react-native-purchases` install is owner-gated + deferred.
- **`paywall` flag stays OFF** until real billing + counsel-final legal land (see `security-abuse.md` "bundled content").
