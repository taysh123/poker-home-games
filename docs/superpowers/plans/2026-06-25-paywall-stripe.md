# Paywall + Stripe (Subsystem 3, Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch on the single live paid benefit (**Premium Study**) behind a **server-authoritative** entitlement, wire **Stripe web checkout** end-to-end (hosted Checkout → webhook source-of-truth + redirect session-verify fallback), present an honest paywall that never sells an unshipped feature, and fix the `EntitlementService` active-subscription shadow bug.

**Architecture:** The money gate is **server-authoritative**: the client trusts `GET /api/entitlements` and never grants premium locally (fail-closed). Stripe grant is **dual**: the `/api/webhooks/stripe` handler is the source of truth (idempotent upsert on `checkout.session.completed` / `customer.subscription.*`), and `POST /api/billing/verify-session` retrieves the Checkout Session on the success-redirect for instant unlock — both upsert the SAME `Subscription` row (keyed by `Store + OriginalTransactionId`, where `OriginalTransactionId` = the Stripe subscription id), so duplicate delivery never double-grants. Backend follows Clean Architecture + CQRS (MediatR command/query + handler + FluentValidation validator, all assembly-scanned — register nothing manually). The client billing seam (`IBillingProvider`) is unchanged; only the web (`stripe`) adapter and provider selection are wired, and the PaywallScreen leads with the one live benefit and renders "Soon" chips for everything else.

**Tech Stack:** Expo SDK 54 (React Native / react-native-web, TypeScript), Jest (`jest-expo` preset, pure-logic tests under `__tests__`), .NET 8 (ASP.NET Core, MediatR, FluentValidation, EF Core / Npgsql, in-memory EF for tests), xUnit, Stripe REST API (no SDK — raw `HttpClient`, hand-rolled HMAC signature verification already present).

---

## Context discovered in the codebase (read before starting)

The Phase-2 billing scaffold is **already substantially built**; this plan finishes and corrects it. Do NOT re-create these — extend them:

- **Stripe webhook handler EXISTS.** `src/PokerApp.API/Controllers/WebhooksController.cs` has `POST api/webhooks/stripe` → reads the raw body + `Stripe-Signature` → `IStoreNotificationVerifier.VerifyStripeAsync` (`StoreNotificationVerifier.cs`, fail-closed via `StripeSignature.Verify`) → `ProcessStoreNotificationCommand`. Idempotency/replay is enforced by the unique index `IX_StoreWebhookEvents_NotificationUuid` (the Stripe event `id` is the uuid). **The gap:** `ProcessStoreNotificationCommandHandler` only mutates an *existing* `Subscription` (`if (sub is not null) { … }`). On `checkout.session.completed` / `customer.subscription.created` for a brand-new subscriber there is no `Subscription.Create`, AND the normalized `StoreNotificationDto` carries no `userId` (Stripe puts it in `client_reference_id`) and no plan/period for create. So the webhook today **cannot grant premium on first purchase** — Task 7 fixes this.
- **Redirect session-verify is 90% there.** `StripeBillingVerifier.cs` (`IBillingVerifier`) retrieves `GET /v1/checkout/sessions/{id}?expand[]=subscription` and maps a paid/active session → `VerifiedSubscription` (keyed by `sub.id`). `ValidatePurchaseCommand` already upserts `Subscription.Create`/`Sync` and returns the `EntitlementDto`. The client calls this via `POST /api/billing/validate {store, token}`. Task 6 adds a **dedicated, named** `POST /api/billing/verify-session {sessionId}` (clearer contract for the web flow) that reuses the exact same verifier + upsert, so it is idempotent with both `validate` and the webhook.
- **`StripeCheckoutService` EXISTS** (`src/PokerApp.Infrastructure/Billing/StripeCheckoutService.cs`): subscription-mode Checkout via raw HTTP, env Price IDs (`StripeSettings.PriceIdFor`), `client_reference_id = userId`, `success_url = {WebBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`, `cancel_url = {WebBaseUrl}/billing/cancel`, fail-closed to `null`. `CreateCheckoutSessionCommand` maps `null → BadRequestException`. Task 5 adds the missing **unit test** + carries `metadata[userId]` as a belt-and-suspenders for the webhook create path.
- **`EntitlementService.cs` shadow bug CONFIRMED.** `db.Subscriptions.Where(UserId).OrderByDescending(s => s.CurrentPeriodEnd).FirstOrDefault()` then checks `IsPremiumActive(now)`. A refunded/expired sub with a far-future `CurrentPeriodEnd` is selected FIRST and shadows a genuinely active sub → user wrongly shows free. Task 8 fixes it (filter to active candidates first). TDD with a red test reproducing the shadow.
- **Client billing seam.** `apps/poker-mobile/src/features/premium/types.ts` defines `IBillingProvider { id, getProducts, purchase, restore }`. `state/PremiumContext.tsx` calls `getBillingProvider()` (no arg → **mock**, always). `providers/index.ts` has `billingProviderIdForPlatform(os)` (web→stripe, native→revenuecat) but nothing calls it on the default path. `providers/stripeBillingProvider.ts` is already drafted (key-gated on `BILLING_KEYS.stripePublishableKey`, calls `createCheckoutSession` → opens browser → re-reads `getEntitlements`). Tasks 3–4 finish web selection (key-gated, fail-closed to mock), the success-redirect verify call, the honest `premium_study` benefit, and the PaywallScreen.
- **`api/monetizationApi.ts`** has `createCheckoutSession(plan, token)` (`POST /api/billing/checkout`), `validatePurchase(store, token, token)` (`POST /api/billing/validate`), `getEntitlements(token)` (`GET /api/entitlements`). Task 6 (client side) adds `verifyCheckoutSession(sessionId, token)` (`POST /api/billing/verify-session`).
- **Jest config** (`apps/poker-mobile/jest.config.js`): preset `jest-expo`; `testMatch` includes `**/src/features/**/__tests__/**/*.test.ts` (note: `.ts`, not `.tsx`). There are **no** premium jest tests yet. Keep premium tests pure-logic (`.test.ts`); the PaywallScreen "lead/Soon/price" assertions are written as **pure data-shape tests** over `PREMIUM_FEATURES` + a small exported helper, not React render tests (the repo has no RN render-test harness).
- **xUnit test harness** (`src/PokerApp.Tests/`): `TestInfra.NewContext()` returns an in-memory `AppDbContext` (`UseInMemoryDatabase(Guid)`); `FakeCurrentUser(id) : ICurrentUserService`; `CapturingAuditLog : IAuditLog`; `FakeHttpMessageHandler(status, body)` returns a canned HTTP response and records `LastRequest`. Existing billing tests live in `B2EnforcementTests.cs` (`BillingFlowTests`, `EntitlementServiceTests`) and `StripeBillingVerifierTests.cs`. Mirror these exactly.

**Honesty invariant (spec §10):** exactly ONE `comingSoon:false` premium feature, and it is `premium_study`; `solver` stays OFF; the paywall never shows a purchase CTA next to a Soon feature.

---

## File Structure

**Client (`apps/poker-mobile/src/`):**
- `features/premium/config.ts` — *modify*: add `premium_study` to `PremiumFeatureKey` + `PREMIUM_FEATURES` (`comingSoon:false`, exact copy); add an exported `LIVE_PREMIUM_FEATURES` / `liveFeatureKeys()` helper used by the paywall + honesty test.
- `features/premium/providers/index.ts` — *modify*: add `resolveActiveBillingProvider()` that key-gates web→stripe (else mock), native→revenuecat-or-mock; fail-closed.
- `features/premium/providers/stripeBillingProvider.ts` — *modify*: finish the web flow (full-page redirect on web; after success-redirect, call the new redirect verify-session then refresh entitlements).
- `features/premium/state/PremiumContext.tsx` — *modify*: use `resolveActiveBillingProvider()` instead of the hardcoded `getBillingProvider()` (mock); add a `verifyPendingCheckout(sessionId)` action used by the success-redirect.
- `features/premium/ui/PaywallScreen.tsx` — *modify*: lead with `premium_study`, Soon chips for the rest, yearly-default toggle with "save 30%", honest price, a11y; no purchase CTA on Soon features.
- `api/monetizationApi.ts` — *modify*: add `verifyCheckoutSession(sessionId, token)` → `POST /api/billing/verify-session`.
- `features/premium/__tests__/honesty.test.ts` — *create*: CI guard — exactly one `comingSoon:false`, and it is `premium_study`.
- `features/premium/__tests__/providerSelection.test.ts` — *create*: web key present→stripe; web key absent→mock (fail-closed); native→revenuecat/mock.
- `features/premium/__tests__/paywallContent.test.ts` — *create*: only `premium_study` is "live"; Soon features never expose a purchase CTA (asserted via the exported helper the screen consumes); price falls back to config when SDK price absent.

**Backend:**
- `src/PokerApp.Infrastructure/Services/EntitlementService.cs` — *modify*: filter to active candidates before ordering (shadow-bug fix).
- `src/PokerApp.Application/Features/Billing/Commands/ProcessStoreNotificationCommand.cs` — *modify*: extend the normalized DTO + handler so a Stripe `renew` (checkout/subscription.created) **creates** the `Subscription` when absent (needs userId + plan + period); still idempotent + out-of-order-safe.
- `src/PokerApp.Infrastructure/Billing/StoreNotificationVerifier.cs` — *modify*: extract `client_reference_id` / `metadata[userId]`, price id, and period for Stripe so the create path has data.
- `src/PokerApp.Application/Features/Billing/Commands/VerifySession/VerifyCheckoutSessionCommand.cs` — *create*: `IRequest<EntitlementDto>` + handler + validator (retrieve via `IBillingVerifier` for Stripe → idempotent upsert → return entitlement).
- `src/PokerApp.API/Controllers/BillingController.cs` — *modify*: add `POST billing/verify-session`.
- `src/PokerApp.Infrastructure/Billing/StripeCheckoutService.cs` — *modify*: add `metadata[userId]` to the session (so the webhook create path has the userId even if `client_reference_id` is unavailable).
- `src/PokerApp.Tests/EntitlementServiceShadowTests.cs` — *create*: red test for the shadow bug.
- `src/PokerApp.Tests/StripeCheckoutServiceTests.cs` — *create*: checkout-session creation (success_url carries session id; not-configured → null).
- `src/PokerApp.Tests/StripeWebhookGrantTests.cs` — *create*: webhook creates+grants on first checkout; duplicate delivery ≠ double-grant.
- `src/PokerApp.Tests/VerifyCheckoutSessionTests.cs` — *create*: verify-session grants premium; idempotent with the webhook (no second row).

**Docs:**
- `docs/release/stripe-setup.md` — *create*: human actions (§12) — Stripe dashboard, env vars (Railway/Vercel), test→live switch, and the `stripe listen` E2E manual test.
- `docs/release/prod-visible-changes.md` — *modify (append)*: ledger the paywall-on / Stripe-live change (reversible by the `paywall` flag).

---

## Task 1: Add the live `premium_study` benefit (honest copy)

**Files:**
- Modify: `apps/poker-mobile/src/features/premium/config.ts`
- Test: `apps/poker-mobile/src/features/premium/__tests__/honesty.test.ts`

- [ ] **Step 1: Write the failing honesty test (CI guard — spec §10)**

Create `apps/poker-mobile/src/features/premium/__tests__/honesty.test.ts`:

```ts
import { PREMIUM_FEATURES } from '../config';

describe('honesty gate (spec §10)', () => {
  it('has exactly ONE live (comingSoon:false) premium feature and it is premium_study', () => {
    const live = PREMIUM_FEATURES.filter(f => f.comingSoon === false);
    expect(live).toHaveLength(1);
    expect(live[0].key).toBe('premium_study');
  });

  it('every other premium feature is marked comingSoon:true', () => {
    const others = PREMIUM_FEATURES.filter(f => f.key !== 'premium_study');
    expect(others.length).toBeGreaterThan(0);
    expect(others.every(f => f.comingSoon === true)).toBe(true);
  });

  it('uses the exact approved premium_study benefit copy', () => {
    const study = PREMIUM_FEATURES.find(f => f.key === 'premium_study');
    expect(study?.desc).toBe(
      'Full lesson library — every study pack · all quizzes · unlimited Spot Trainer',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/poker-mobile && npx jest src/features/premium/__tests__/honesty.test.ts`
Expected: FAIL — no `premium_study` key in `PREMIUM_FEATURES` (find returns undefined; `live` has length 0).

- [ ] **Step 3: Add `premium_study` to config (minimal impl)**

In `apps/poker-mobile/src/features/premium/config.ts`, extend the key union and prepend the live feature. Replace the `PremiumFeatureKey` type:

```ts
export type PremiumFeatureKey =
  | 'premium_study'
  | 'advanced_gto' | 'ai_coach' | 'advanced_bankroll' | 'cloud_sync' | 'premium_learning';
```

Replace the `PREMIUM_FEATURES` array (lead with the live benefit; mark the rest Soon explicitly):

```ts
export const PREMIUM_FEATURES: { key: PremiumFeatureKey; icon: string; title: string; desc: string; comingSoon: boolean }[] = [
  { key: 'premium_study',     icon: 'library',     title: 'Premium Study',           desc: 'Full lesson library — every study pack · all quizzes · unlimited Spot Trainer', comingSoon: false },
  { key: 'ai_coach',          icon: 'sparkles',    title: 'AI Coach',                desc: '30 hand analyses every month', comingSoon: true },
  { key: 'advanced_gto',      icon: 'school',      title: 'Advanced GTO study',      desc: 'Deeper ranges, sizings & spots', comingSoon: true },
  { key: 'advanced_bankroll', icon: 'stats-chart', title: 'Advanced bankroll analytics', desc: 'Variance, filters & deeper trends', comingSoon: true },
  { key: 'cloud_sync',        icon: 'cloud-done',  title: 'Cloud sync',              desc: 'Your data, across all devices', comingSoon: true },
  { key: 'premium_learning',  icon: 'library',     title: 'Premium learning',        desc: 'Courses & guided study paths', comingSoon: true },
];
```

Note: `comingSoon` is now non-optional (`boolean`) so the honesty test's `=== false` / `=== true` checks are exact; this matches the spec's intent that the flag is always explicit.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/poker-mobile && npx jest src/features/premium/__tests__/honesty.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no errors (PaywallScreen already reads `f.comingSoon`; non-optional boolean is assignable).

- [ ] **Step 6: Commit**

```powershell
git add apps/poker-mobile/src/features/premium/config.ts apps/poker-mobile/src/features/premium/__tests__/honesty.test.ts
git commit -m @'
feat(premium): add live premium_study benefit + honesty CI guard

Exactly one comingSoon:false feature (premium_study) with the approved
copy; all other premium features stay Soon. Jest test pins the invariant.
'@
```

---

## Task 2: Export a live-feature helper for the paywall + content tests

**Files:**
- Modify: `apps/poker-mobile/src/features/premium/config.ts`
- Test: `apps/poker-mobile/src/features/premium/__tests__/paywallContent.test.ts`

- [ ] **Step 1: Write the failing content test**

Create `apps/poker-mobile/src/features/premium/__tests__/paywallContent.test.ts`:

```ts
import { PREMIUM_FEATURES, liveFeatureKeys, isFeatureLive, paywallPriceFor, PRICING } from '../config';

describe('paywall content rules', () => {
  it('only premium_study is live; everything else is Soon', () => {
    expect(liveFeatureKeys()).toEqual(['premium_study']);
    expect(isFeatureLive('premium_study')).toBe(true);
    for (const f of PREMIUM_FEATURES) {
      if (f.key !== 'premium_study') expect(isFeatureLive(f.key)).toBe(false);
    }
  });

  it('a Soon feature must never be the purchasable CTA target', () => {
    // The screen only ever charges for live features; assert no Soon feature is "live".
    const soon = PREMIUM_FEATURES.filter(f => f.comingSoon);
    expect(soon.every(f => !isFeatureLive(f.key))).toBe(true);
  });

  it('price uses the SDK-localized value when present, else the config fallback', () => {
    expect(paywallPriceFor('yearly', undefined)).toBe(PRICING.yearly.price);   // $99.99
    expect(paywallPriceFor('monthly', undefined)).toBe(PRICING.monthly.price); // $11.99
    expect(paywallPriceFor('yearly', '₪399/yr')).toBe('₪399/yr');              // SDK wins
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/poker-mobile && npx jest src/features/premium/__tests__/paywallContent.test.ts`
Expected: FAIL — `liveFeatureKeys` / `isFeatureLive` / `paywallPriceFor` are not exported.

- [ ] **Step 3: Add the helpers (minimal impl)**

Append to `apps/poker-mobile/src/features/premium/config.ts`:

```ts
/** Keys of premium features that are genuinely live (chargeable). Single source for paywall + tests. */
export function liveFeatureKeys(): PremiumFeatureKey[] {
  return PREMIUM_FEATURES.filter(f => f.comingSoon === false).map(f => f.key);
}

/** True when a feature is live (not Soon) — the paywall only charges for these. */
export function isFeatureLive(key: PremiumFeatureKey): boolean {
  return PREMIUM_FEATURES.some(f => f.key === key && f.comingSoon === false);
}

/** Display price: prefer the billing-SDK/Stripe localized value; else the honest config fallback. */
export function paywallPriceFor(plan: 'monthly' | 'yearly', sdkPrice: string | undefined): string {
  return sdkPrice ?? PRICING[plan].price;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/poker-mobile && npx jest src/features/premium/__tests__/paywallContent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```powershell
git add apps/poker-mobile/src/features/premium/config.ts apps/poker-mobile/src/features/premium/__tests__/paywallContent.test.ts
git commit -m @'
feat(premium): live-feature + price helpers for the paywall

liveFeatureKeys/isFeatureLive (single source the paywall consumes so a
Soon feature can never be the CTA) and paywallPriceFor (SDK price else
honest config fallback). Pinned by tests.
'@
```

---

## Task 3: Key-gated, fail-closed billing-provider selection

**Files:**
- Modify: `apps/poker-mobile/src/features/premium/providers/index.ts`
- Test: `apps/poker-mobile/src/features/premium/__tests__/providerSelection.test.ts`

- [ ] **Step 1: Write the failing selection test**

Create `apps/poker-mobile/src/features/premium/__tests__/providerSelection.test.ts`:

```ts
import { resolveActiveBillingProviderId } from '../providers';

describe('active billing provider selection (fail-closed)', () => {
  it('web selects stripe ONLY when the publishable key is present', () => {
    expect(resolveActiveBillingProviderId('web', 'pk_test_123')).toBe('stripe');
  });

  it('web with no publishable key falls back to mock (fail-closed — never a live charge unconfigured)', () => {
    expect(resolveActiveBillingProviderId('web', '')).toBe('mock');
  });

  it('native selects revenuecat when its key is present, else mock', () => {
    expect(resolveActiveBillingProviderId('ios', '', 'appl_rc_123')).toBe('revenuecat');
    expect(resolveActiveBillingProviderId('android', '', '')).toBe('mock');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/poker-mobile && npx jest src/features/premium/__tests__/providerSelection.test.ts`
Expected: FAIL — `resolveActiveBillingProviderId` is not exported.

- [ ] **Step 3: Add the pure resolver + active-provider getter (minimal impl)**

In `apps/poker-mobile/src/features/premium/providers/index.ts`, add the import and the new exports (keep existing `getBillingProvider` / `billingProviderIdForPlatform`):

```ts
import { Platform } from 'react-native';
import { BILLING_KEYS } from '../config';
// ...existing imports...

/**
 * Pure, testable provider-id resolver. Real billing is KEY-GATED + fail-closed: web uses Stripe only
 * when the publishable key exists (else mock — never a live charge while unconfigured); native uses
 * RevenueCat only when its key exists (else mock). Defaults are mock so production is unchanged until
 * keys are supplied.
 */
export function resolveActiveBillingProviderId(
  os: string,
  stripePublishableKey: string,
  revenueCatApiKey = '',
): BillingProviderId {
  if (os === 'web') return stripePublishableKey ? 'stripe' : 'mock';
  return revenueCatApiKey ? 'revenuecat' : 'mock';
}

/** The provider that is active right now, given platform + configured keys. Fail-closed to mock. */
export function resolveActiveBillingProvider(): IBillingProvider {
  return getBillingProvider(
    resolveActiveBillingProviderId(Platform.OS, BILLING_KEYS.stripePublishableKey, BILLING_KEYS.revenueCatApiKey),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/poker-mobile && npx jest src/features/premium/__tests__/providerSelection.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```powershell
git add apps/poker-mobile/src/features/premium/providers/index.ts apps/poker-mobile/src/features/premium/__tests__/providerSelection.test.ts
git commit -m @'
feat(premium): key-gated, fail-closed billing-provider selection

resolveActiveBillingProviderId (pure) + resolveActiveBillingProvider:
web->stripe only with a publishable key, native->revenuecat only with
its key, else mock. Unconfigured can never become a live charge.
'@
```

---

## Task 4: Finish the Stripe web purchase flow + wire PremiumContext

**Files:**
- Modify: `apps/poker-mobile/src/features/premium/providers/stripeBillingProvider.ts`
- Modify: `apps/poker-mobile/src/features/premium/state/PremiumContext.tsx`
- Modify: `apps/poker-mobile/src/api/monetizationApi.ts` (the new `verifyCheckoutSession` is added in Task 6; here only the redirect open/return is finished)

> No new unit test file here — the web redirect (`window.location`) + `expo-web-browser` are environment side-effects not exercised by the pure-logic jest harness. Correctness is covered by Task 3 (selection), the backend verify/webhook tasks, and the `stripe listen` E2E in `docs/release/stripe-setup.md`. The change is gated by `npx tsc --noEmit` + `npx expo export -p web`.

- [ ] **Step 1: Implement the web full-page redirect in `purchase()`**

In `apps/poker-mobile/src/features/premium/providers/stripeBillingProvider.ts`, replace the body of `purchase()` so that on **web** it does a full-page redirect to the hosted Checkout URL (the success_url returns to the app, which verifies on mount), and on native it opens the in-app browser then re-reads the server entitlement:

```ts
import { Platform } from 'react-native';
// ...existing imports (SecureStore, createCheckoutSession, getEntitlements, BILLING_KEYS, PRICING, types)...

  async purchase(productId: string): Promise<PurchaseResult> {
    requireConfigured();
    const plan = planFor(productId);
    if (!plan) return { ok: false, error: 'unknown_product' };
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) return { ok: false, error: 'requires_account' };
    try {
      const { url } = await createCheckoutSession(plan, token);
      if (Platform.OS === 'web') {
        // Full-page redirect to hosted Stripe Checkout. success_url returns to /billing/success
        // (carrying session_id), where the app runs verify-session + refreshes entitlement on mount.
        // This call does not resolve before navigation away, so report "redirecting".
        (globalThis as unknown as { location?: { href: string } }).location!.href = url;
        return { ok: false, error: 'redirecting' };
      }
      const WebBrowser = await import('expo-web-browser');
      await WebBrowser.openBrowserAsync(url);
      const ent = await getEntitlements(token); // server is authoritative (granted only after the webhook/verify)
      return ent.plan === 'premium'
        ? { ok: true, entitlement: { plan: 'premium', productId, since: new Date().toISOString() } }
        : { ok: false, error: 'pending_verification' };
    } catch {
      return { ok: false, error: 'checkout_failed' };
    }
  },
```

- [ ] **Step 2: Point PremiumContext at the active provider + add `verifyPendingCheckout`**

In `apps/poker-mobile/src/features/premium/state/PremiumContext.tsx`:

Replace the import:

```ts
import { getBillingProvider, resolveActiveBillingProvider } from '../providers';
```

Replace the two `getBillingProvider()` call sites (the `useEffect` provider + the `purchase` callback) with `resolveActiveBillingProvider()`. Then add a `verifyPendingCheckout` action and expose it on the context value/type. The action calls the new `verifyCheckoutSession` API (added in Task 6) and updates local entitlement from the server result:

```ts
import { getEntitlements, verifyCheckoutSession } from '../../../api/monetizationApi';
import * as SecureStore from '../../../utils/storage';

// add to PremiumContextType:
//   verifyPendingCheckout: (sessionId: string) => Promise<{ ok: boolean }>;

const verifyPendingCheckout = useCallback(async (sessionId: string) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (!token) return { ok: false };
  try {
    const ent = await verifyCheckoutSession(sessionId, token); // server-authoritative
    const next: EntitlementState = ent.plan === 'premium'
      ? { plan: 'premium', productId: ent.productId ?? undefined, since: new Date().toISOString() }
      : FREE_ENTITLEMENT;
    setEntitlement(next);
    await saveEntitlement(next);
    return { ok: ent.plan === 'premium' };
  } catch {
    return { ok: false };
  }
}, []);
```

Add `verifyPendingCheckout` to both the default context object and the provider `value={{ … }}`.

- [ ] **Step 3: Typecheck**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no errors. (Note: `verifyCheckoutSession` must already exist — if executing tasks out of order, do Task 6 client-side step first.)

- [ ] **Step 4: Web export smoke**

Run: `cd apps/poker-mobile && npx expo export -p web`
Expected: build succeeds (the lazy `import('expo-web-browser')` stays out of the web bundle's eager graph).

- [ ] **Step 5: Commit**

```powershell
git add apps/poker-mobile/src/features/premium/providers/stripeBillingProvider.ts apps/poker-mobile/src/features/premium/state/PremiumContext.tsx
git commit -m @'
feat(premium): finish Stripe web purchase + verify-on-return

Web purchase() does a full-page redirect to hosted Checkout; native opens
an in-app browser then re-reads server entitlement. PremiumContext uses
the key-gated active provider and adds verifyPendingCheckout(sessionId)
for the success-redirect (server-authoritative).
'@
```

---

## Task 5: Backend — Stripe Checkout session creation (test + userId metadata)

**Files:**
- Modify: `src/PokerApp.Infrastructure/Billing/StripeCheckoutService.cs`
- Test: `src/PokerApp.Tests/StripeCheckoutServiceTests.cs`

- [ ] **Step 1: Write the failing test (mirrors `StripeBillingVerifierTests` style)**

Create `src/PokerApp.Tests/StripeCheckoutServiceTests.cs`:

```csharp
using System;
using System.Net;
using System.Threading.Tasks;
using PokerApp.Infrastructure.Billing;
using PokerApp.Infrastructure.Settings;
using Xunit;

namespace PokerApp.Tests;

public class StripeCheckoutServiceTests
{
    private sealed class FakeWeb(string url) : PokerApp.Application.Common.Interfaces.IWebSettings
    {
        public string WebBaseUrl { get; } = url;
    }

    private static StripeCheckoutService Service(FakeHttpMessageHandler handler, bool configured = true)
        => new(new StripeSettings
               {
                   SecretKey = configured ? "sk_test" : "",
                   PriceMonthlyId = "price_monthly",
                   PriceYearlyId = "price_yearly",
               },
               new FakeWeb("https://poker-home-games-three.vercel.app"),
               new System.Net.Http.HttpClient(handler));

    [Fact]
    public async Task Creates_a_subscription_session_and_returns_the_hosted_url()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK,
            "{\"id\":\"cs_test_1\",\"url\":\"https://checkout.stripe.com/c/pay/cs_test_1\"}");
        var url = await Service(handler).CreateSubscriptionCheckoutUrlAsync(Guid.NewGuid(), "yearly");

        Assert.Equal("https://checkout.stripe.com/c/pay/cs_test_1", url);
        var body = await handler.LastRequest!.Content!.ReadAsStringAsync();
        Assert.Contains("mode=subscription", body);
        Assert.Contains("price_yearly", body);
        Assert.Contains("session_id%3D%7BCHECKOUT_SESSION_ID%7D", body); // success_url carries the session id
    }

    [Fact]
    public async Task Returns_null_when_not_configured()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.OK, "{\"url\":\"x\"}");
        Assert.Null(await Service(handler, configured: false).CreateSubscriptionCheckoutUrlAsync(Guid.NewGuid(), "monthly"));
    }

    [Fact]
    public async Task Returns_null_on_stripe_api_error()
    {
        var handler = new FakeHttpMessageHandler(HttpStatusCode.BadRequest, "boom");
        Assert.Null(await Service(handler).CreateSubscriptionCheckoutUrlAsync(Guid.NewGuid(), "monthly"));
    }
}
```

> Verify the exact namespace of `IWebSettings` while writing (it is `PokerApp.Application.Common.Interfaces`). The `session_id%3D%7B…%7D` assertion is the URL-encoded form of `session_id={CHECKOUT_SESSION_ID}` produced by `FormUrlEncodedContent`.

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test --filter StripeCheckoutServiceTests`
Expected: FAIL on `Creates_a_subscription_session…` if `metadata[userId]` is missing only after Step 3 adds its own assertion — but at this point all three should compile and the create/null tests should already PASS (the service exists). If they PASS, that's expected: this task's net-new value is the regression test + the metadata line. Proceed to Step 3 to add the metadata assertion as the genuine red.

- [ ] **Step 3: Add a `metadata[userId]` assertion (the real red) then implement it**

Add this assertion to `Creates_a_subscription_session_and_returns_the_hosted_url` (after the `price_yearly` assert):

```csharp
        Assert.Contains("metadata%5BuserId%5D", body); // userId carried for the webhook create path
```

Run: `dotnet test --filter StripeCheckoutServiceTests`
Expected: FAIL — body has `client_reference_id` but no `metadata[userId]`.

Then in `src/PokerApp.Infrastructure/Billing/StripeCheckoutService.cs`, add the metadata entry to the `form` dictionary (alongside `client_reference_id`):

```csharp
            ["client_reference_id"] = userId.ToString(),
            ["metadata[userId]"] = userId.ToString(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test --filter StripeCheckoutServiceTests`
Expected: PASS (3 tests).

- [ ] **Step 5: Build gate**

Run: `dotnet build PokerApp.sln`
Expected: Build succeeded.

- [ ] **Step 6: Commit**

```powershell
git add src/PokerApp.Infrastructure/Billing/StripeCheckoutService.cs src/PokerApp.Tests/StripeCheckoutServiceTests.cs
git commit -m @'
test(billing): cover Stripe Checkout creation; carry userId metadata

Pins success_url carrying {CHECKOUT_SESSION_ID}, env price ids, and
mode=subscription; adds metadata[userId] so the webhook create path can
resolve the user even without client_reference_id. Fail-closed on
unconfigured / API error.
'@
```

---

## Task 6: Backend + client — dedicated `POST /api/billing/verify-session` (instant unlock)

**Files:**
- Create: `src/PokerApp.Application/Features/Billing/Commands/VerifySession/VerifyCheckoutSessionCommand.cs`
- Modify: `src/PokerApp.API/Controllers/BillingController.cs`
- Modify: `apps/poker-mobile/src/api/monetizationApi.ts`
- Test: `src/PokerApp.Tests/VerifyCheckoutSessionTests.cs`

- [ ] **Step 1: Write the failing handler test (in-memory EF + a fake verifier; mirrors `BillingFlowTests`)**

Create `src/PokerApp.Tests/VerifyCheckoutSessionTests.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Application.Features.Billing.Commands.VerifySession;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

public class VerifyCheckoutSessionTests
{
    private sealed class StubVerifier(VerifiedSubscription? result) : IBillingVerifier
    {
        public Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default)
            => Task.FromResult(result);
    }

    private static VerifiedSubscription Paid(Guid _) => new(
        SubscriptionStore.Stripe, "price_monthly", "sub_abc",
        DateTime.UtcNow, DateTime.UtcNow.AddMonths(1), AutoRenew: true, IsSandbox: true, Status: SubscriptionStatus.Active);

    [Fact]
    public async Task Paid_session_grants_premium_and_upserts_one_subscription()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var handler = new VerifyCheckoutSessionCommandHandler(
            new StubVerifier(Paid(uid)), ctx, new EntitlementService(ctx), new CapturingAuditLog(), new FakeCurrentUser(uid));

        var ent = await handler.Handle(new VerifyCheckoutSessionCommand("cs_test_1"), default);

        Assert.True(ent.IsPremium);
        Assert.Equal(1, await ctx.Subscriptions.CountAsync());
    }

    [Fact]
    public async Task Verify_is_idempotent_with_the_webhook_no_second_row()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        // Simulate the webhook already created the same Stripe sub (keyed by Store + OriginalTransactionId).
        ctx.Subscriptions.Add(PokerApp.Domain.Entities.Subscription.Create(
            uid, SubscriptionStore.Stripe, "price_monthly", "sub_abc",
            DateTime.UtcNow, DateTime.UtcNow.AddMonths(1), true, true, DateTime.UtcNow));
        await ctx.SaveChangesAsync();

        var handler = new VerifyCheckoutSessionCommandHandler(
            new StubVerifier(Paid(uid)), ctx, new EntitlementService(ctx), new CapturingAuditLog(), new FakeCurrentUser(uid));
        var ent = await handler.Handle(new VerifyCheckoutSessionCommand("cs_test_1"), default);

        Assert.True(ent.IsPremium);
        Assert.Equal(1, await ctx.Subscriptions.CountAsync()); // upserted, not duplicated
    }

    [Fact]
    public async Task Unverifiable_session_throws_bad_request()
    {
        using var ctx = TestInfra.NewContext();
        var handler = new VerifyCheckoutSessionCommandHandler(
            new StubVerifier(null), ctx, new EntitlementService(ctx), new CapturingAuditLog(), new FakeCurrentUser(Guid.NewGuid()));
        await Assert.ThrowsAsync<PokerApp.Application.Common.Exceptions.BadRequestException>(() =>
            handler.Handle(new VerifyCheckoutSessionCommand("cs_bad"), default));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test --filter VerifyCheckoutSessionTests`
Expected: FAIL to compile — `VerifyCheckoutSessionCommand` / handler do not exist.

- [ ] **Step 3: Create the command + validator + handler (CQRS; assembly-scanned — register nothing)**

Create `src/PokerApp.Application/Features/Billing/Commands/VerifySession/VerifyCheckoutSessionCommand.cs`:

```csharp
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Common;
using PokerApp.Application.Common.Exceptions;
using PokerApp.Application.Common.Interfaces;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;

namespace PokerApp.Application.Features.Billing.Commands.VerifySession;

/// <summary>
/// Web success-redirect grant: retrieve the Stripe Checkout Session by id; if paid/active, idempotently
/// upsert the SAME Subscription the webhook upserts (keyed by Store + OriginalTransactionId = the Stripe
/// subscription id) and return the computed entitlement (instant unlock). Server stays authoritative.
/// </summary>
public sealed record VerifyCheckoutSessionCommand(string SessionId) : IRequest<EntitlementDto>;

public sealed class VerifyCheckoutSessionCommandValidator : AbstractValidator<VerifyCheckoutSessionCommand>
{
    public VerifyCheckoutSessionCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty().MaximumLength(255);
    }
}

public sealed class VerifyCheckoutSessionCommandHandler(
    IBillingVerifier verifier,
    IApplicationDbContext context,
    IEntitlementService entitlements,
    IAuditLog audit,
    ICurrentUserService currentUser) : IRequestHandler<VerifyCheckoutSessionCommand, EntitlementDto>
{
    public async Task<EntitlementDto> Handle(VerifyCheckoutSessionCommand request, CancellationToken cancellationToken)
    {
        // Stripe verifier retrieves the session (expand=subscription) and returns null unless paid/active.
        var verified = await verifier.VerifyAsync(SubscriptionStore.Stripe, request.SessionId, cancellationToken)
            ?? throw new BadRequestException("Checkout session could not be verified.");

        var now = DateTime.UtcNow;
        var sub = await context.Subscriptions.FirstOrDefaultAsync(
            s => s.Store == verified.Store && s.OriginalTransactionId == verified.OriginalTransactionId,
            cancellationToken);

        if (sub is null)
        {
            sub = Subscription.Create(currentUser.UserId, verified.Store, verified.ProductId,
                verified.OriginalTransactionId, verified.PeriodStart, verified.PeriodEnd,
                verified.AutoRenew, verified.IsSandbox, now);
            await context.Subscriptions.AddAsync(sub, cancellationToken);
        }
        else
        {
            sub.Sync(verified.ProductId, verified.PeriodStart, verified.PeriodEnd,
                verified.AutoRenew, verified.IsSandbox, verified.Status, now);
        }

        await context.SaveChangesAsync(cancellationToken);
        audit.Record(AuditCategory.SubscriptionLifecycle, "verify_session", currentUser.UserId,
            new { verified.ProductId, verified.IsSandbox, status = verified.Status.ToString() });
        return await entitlements.GetAsync(currentUser.UserId, cancellationToken);
    }
}
```

> Confirm `AuditCategory.SubscriptionLifecycle` exists (used by `ValidatePurchaseCommandHandler`). The handler mirrors `ValidatePurchaseCommandHandler` exactly but is Stripe-fixed and session-id–named for the web contract.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test --filter VerifyCheckoutSessionTests`
Expected: PASS (3 tests).

- [ ] **Step 5: Add the controller endpoint**

In `src/PokerApp.API/Controllers/BillingController.cs`, add the `using` and the action:

```csharp
using PokerApp.Application.Features.Billing.Commands.VerifySession;
```

```csharp
    /// <summary>Verify a Stripe Checkout session on the success redirect → instant, idempotent unlock.</summary>
    [HttpPost("billing/verify-session")]
    [ProducesResponseType(typeof(EntitlementDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifySession([FromBody] VerifyCheckoutSessionCommand command, CancellationToken cancellationToken)
        => Ok(await mediator.Send(command, cancellationToken));
```

- [ ] **Step 6: Add the client API call**

In `apps/poker-mobile/src/api/monetizationApi.ts`, append:

```ts
/**
 * Verify a Stripe Checkout session on the web success-redirect → returns the refreshed (authoritative)
 * server entitlement. Idempotent with the Stripe webhook (same Subscription row). 400s if unverifiable.
 */
export async function verifyCheckoutSession(sessionId: string, token: string): Promise<ServerEntitlement> {
  const { data } = await apiClient.post<ServerEntitlement>('/api/billing/verify-session', { sessionId }, auth(token));
  return data;
}
```

- [ ] **Step 7: Gates**

Run: `dotnet build PokerApp.sln`
Expected: Build succeeded.
Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no errors (this also satisfies Task 4's dependency on `verifyCheckoutSession`).

- [ ] **Step 8: Commit**

```powershell
git add src/PokerApp.Application/Features/Billing/Commands/VerifySession/VerifyCheckoutSessionCommand.cs src/PokerApp.API/Controllers/BillingController.cs apps/poker-mobile/src/api/monetizationApi.ts src/PokerApp.Tests/VerifyCheckoutSessionTests.cs
git commit -m @'
feat(billing): POST /api/billing/verify-session for instant web unlock

Retrieves the Stripe Checkout session, idempotently upserts the same
Subscription the webhook upserts (keyed by Store+OriginalTransactionId),
returns the server entitlement. CQRS command+validator+handler
(assembly-scanned). Client verifyCheckoutSession wired.
'@
```

---

## Task 7: Backend — make the Stripe webhook GRANT on first purchase (create + idempotent)

**Files:**
- Modify: `src/PokerApp.Infrastructure/Billing/StoreNotificationVerifier.cs`
- Modify: `src/PokerApp.Application/Features/Billing/Commands/ProcessStoreNotificationCommand.cs`
- Test: `src/PokerApp.Tests/StripeWebhookGrantTests.cs`

> Why this task: today `ProcessStoreNotificationCommandHandler` only mutates an *existing* sub. A new Stripe subscriber's `checkout.session.completed` is deduped + audited but never creates a `Subscription`, so the webhook alone cannot grant premium. We extend the normalized DTO with the optional fields needed to *create* (userId + plan + period), parse them for Stripe, and create-on-renew when absent — staying idempotent (the `StoreWebhookEvent` unique index already dedupes by event id) and out-of-order-safe.

- [ ] **Step 1: Write the failing webhook-grant test (in-memory EF; mirrors `BillingFlowTests`)**

Create `src/PokerApp.Tests/StripeWebhookGrantTests.cs`:

```csharp
using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PokerApp.Application.Features.Billing.Commands;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

public class StripeWebhookGrantTests
{
    private static StoreNotificationDto Completed(Guid uid, string subId, string uuid) => new(
        NotificationUuid: uuid,
        Type: "renew",
        OriginalTransactionId: subId,
        EventAtUtc: DateTime.UtcNow,
        PeriodEnd: DateTime.UtcNow.AddMonths(1))
    {
        UserId = uid,
        ProductId = "price_monthly",
        PeriodStart = DateTime.UtcNow,
    };

    [Fact]
    public async Task First_checkout_completed_creates_subscription_and_grants_premium()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var handler = new ProcessStoreNotificationCommandHandler(ctx, new CapturingAuditLog());

        await handler.Handle(new ProcessStoreNotificationCommand("stripe", Completed(uid, "sub_1", "evt_1")), default);

        Assert.Equal(1, await ctx.Subscriptions.CountAsync());
        Assert.True((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }

    [Fact]
    public async Task Duplicate_delivery_does_not_double_grant()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        var handler = new ProcessStoreNotificationCommandHandler(ctx, new CapturingAuditLog());
        var notif = Completed(uid, "sub_1", "evt_1");

        await handler.Handle(new ProcessStoreNotificationCommand("stripe", notif), default);
        await handler.Handle(new ProcessStoreNotificationCommand("stripe", notif), default); // replay (same event id)

        Assert.Equal(1, await ctx.Subscriptions.CountAsync());      // not duplicated
        Assert.Equal(1, await ctx.StoreWebhookEvents.CountAsync()); // deduped
        Assert.True((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test --filter StripeWebhookGrantTests`
Expected: FAIL to compile — `StoreNotificationDto` has no `UserId` / `ProductId` / `PeriodStart` settable members.

- [ ] **Step 3: Extend the normalized DTO (additive, optional fields)**

In `src/PokerApp.Application/Features/Billing/Commands/ProcessStoreNotificationCommand.cs`, change the record to carry optional create-fields (Apple/Google leave them null — unchanged behaviour):

```csharp
/// <summary>Normalized store notification. The base fields exist for all stores; the optional fields are
/// populated for stores whose webhook can CREATE a subscription on first purchase (Stripe carries the user
/// via client_reference_id/metadata + plan price + period). Apple/Google leave them null.</summary>
public sealed record StoreNotificationDto(
    string NotificationUuid,
    string Type,                 // renew | cancel | expire | grace | refund
    string OriginalTransactionId,
    DateTime EventAtUtc,
    DateTime? PeriodEnd)
{
    public Guid? UserId { get; init; }
    public string? ProductId { get; init; }
    public DateTime? PeriodStart { get; init; }
}
```

- [ ] **Step 4: Create-on-renew in the handler (idempotent + out-of-order-safe)**

In the same file, replace the `if (sub is not null) { switch … }` block so a `renew` for an absent sub **creates** it when the create-fields are present (Apple/Google with no userId fall through to the existing no-op, unchanged):

```csharp
        if (sub is null)
        {
            // First-purchase grant: only stores that supply the user + period can create (Stripe).
            if (n.Type == "renew" && n.UserId is Guid uid)
            {
                sub = Subscription.Create(uid, store, n.ProductId ?? string.Empty, n.OriginalTransactionId,
                    n.PeriodStart ?? n.EventAtUtc, n.PeriodEnd ?? n.EventAtUtc.AddMonths(1),
                    autoRenew: true, isSandbox: false, n.EventAtUtc);
                await context.Subscriptions.AddAsync(sub, cancellationToken);
            }
        }
        else
        {
            switch (n.Type)
            {
                case "renew":
                    sub.Sync(sub.ProductId, sub.CurrentPeriodStart, n.PeriodEnd ?? sub.CurrentPeriodEnd,
                        autoRenew: true, sub.IsSandbox, SubscriptionStatus.Active, n.EventAtUtc);
                    break;
                case "cancel": sub.MarkCanceled(n.EventAtUtc); break;
                case "expire": sub.MarkExpired(n.EventAtUtc); break;
                case "grace": sub.MarkGrace(n.EventAtUtc); break;
                case "refund": sub.MarkRefunded(n.EventAtUtc); break;
            }
        }
```

(The existing `StoreWebhookEvent` insert + `SaveChangesAsync` below this block already make replay a no-op: the second delivery short-circuits at the `AnyAsync(NotificationUuid)` dedupe check before reaching here.)

- [ ] **Step 5: Run test to verify it passes**

Run: `dotnet test --filter StripeWebhookGrantTests`
Expected: PASS (2 tests).

- [ ] **Step 6: Parse the Stripe create-fields in the verifier**

In `src/PokerApp.Infrastructure/Billing/StoreNotificationVerifier.cs`, in `VerifyStripeAsync`, populate the new fields on the returned DTO. After computing `subId`, read the user from `client_reference_id` (on the session object) or `metadata.userId`, plus the price id and period:

```csharp
            Guid? userId = null;
            var clientRef = Str(obj, "client_reference_id");
            if (Guid.TryParse(clientRef, out var cr)) userId = cr;
            else if (obj.TryGetProperty("metadata", out var md) && md.ValueKind == JsonValueKind.Object
                     && Guid.TryParse(Str(md, "userId"), out var mdUid)) userId = mdUid;

            return Task.FromResult<StoreNotificationDto?>(new StoreNotificationDto(
                eventId, MapStripe(type, obj), subId,
                EpochSeconds(Ms(root, "created")) ?? nowUtc, EpochSeconds(StripePeriodEnd(obj)))
            {
                UserId = userId,
                ProductId = StripeFirstPrice(obj),
                PeriodStart = EpochSeconds(StripePeriodStart(obj)),
            });
```

Add these private helpers next to `StripePeriodEnd` (mirrors the verifier's item-level fallback):

```csharp
    private static long StripePeriodStart(JsonElement obj)
    {
        var v = Ms(obj, "current_period_start");
        if (v > 0) return v;
        if (obj.TryGetProperty("items", out var items) && items.TryGetProperty("data", out var data)
            && data.ValueKind == JsonValueKind.Array && data.GetArrayLength() > 0)
            return Ms(data[0], "current_period_start");
        return 0;
    }

    private static string StripeFirstPrice(JsonElement obj) =>
        obj.TryGetProperty("items", out var items) && items.TryGetProperty("data", out var data)
        && data.ValueKind == JsonValueKind.Array && data.GetArrayLength() > 0
        && data[0].TryGetProperty("price", out var price) ? Str(price, "id") : "";
```

> Note: for `checkout.session.completed` the `client_reference_id` lives on the *session* object, while `customer.subscription.created` carries the price/period on the *subscription* object. Both reach this code through `obj`; the helpers read whichever fields are present and fall back gracefully. Confirm exact field names against the live Stripe API when keys exist (already flagged in the file's doc comment).

- [ ] **Step 7: Build + full test gate**

Run: `dotnet build PokerApp.sln`
Expected: Build succeeded.
Run: `dotnet test`
Expected: all tests pass (existing webhook idempotency test `Webhook_Refund_RevokesPremium_AndIsIdempotent` still green — Apple path unchanged).

- [ ] **Step 8: Commit**

```powershell
git add src/PokerApp.Infrastructure/Billing/StoreNotificationVerifier.cs src/PokerApp.Application/Features/Billing/Commands/ProcessStoreNotificationCommand.cs src/PokerApp.Tests/StripeWebhookGrantTests.cs
git commit -m @'
feat(billing): Stripe webhook grants premium on first purchase

ProcessStoreNotification now CREATES the Subscription on a Stripe renew
(checkout.session.completed / subscription.created) when the user+period
are present; verifier extracts client_reference_id/metadata userId, price
id, and period. Idempotent (event-id dedupe) so duplicate delivery never
double-grants. Apple/Google paths unchanged.
'@
```

---

## Task 8: Backend — fix the `EntitlementService` active-sub shadow bug (TDD)

**Files:**
- Modify: `src/PokerApp.Infrastructure/Services/EntitlementService.cs`
- Test: `src/PokerApp.Tests/EntitlementServiceShadowTests.cs`

- [ ] **Step 1: Write the failing RED test reproducing the shadow**

Create `src/PokerApp.Tests/EntitlementServiceShadowTests.cs`:

```csharp
using System;
using System.Threading.Tasks;
using PokerApp.Domain.Entities;
using PokerApp.Domain.Enums;
using PokerApp.Infrastructure.Services;
using Xunit;

namespace PokerApp.Tests;

public class EntitlementServiceShadowTests
{
    [Fact]
    public async Task An_active_sub_is_not_shadowed_by_a_refunded_sub_with_a_later_period_end()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();

        // Genuinely active now (ends in 10 days).
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Stripe, "price_monthly", "sub_active",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(10), true, false, DateTime.UtcNow));

        // Refunded but with a FAR-FUTURE period end (e.g. an annual sub refunded mid-term).
        var refunded = Subscription.Create(uid, SubscriptionStore.Stripe, "price_yearly", "sub_refunded",
            DateTime.UtcNow.AddDays(-2), DateTime.UtcNow.AddDays(300), true, false, DateTime.UtcNow.AddDays(-2));
        refunded.MarkRefunded(DateTime.UtcNow.AddDays(-1)); // status=Refunded, but CurrentPeriodEnd stays +300d
        ctx.Subscriptions.Add(refunded);
        await ctx.SaveChangesAsync();

        var ent = await new EntitlementService(ctx).GetAsync(uid);

        Assert.True(ent.IsPremium); // FAILS today: refunded (later period end) is selected first, then fails the active check
        Assert.Equal("price_monthly", ent.ProductId);
    }

    [Fact]
    public async Task Returns_free_when_only_an_expired_sub_exists()
    {
        using var ctx = TestInfra.NewContext();
        var uid = Guid.NewGuid();
        ctx.Subscriptions.Add(Subscription.Create(uid, SubscriptionStore.Stripe, "price_monthly", "sub_old",
            DateTime.UtcNow.AddDays(-40), DateTime.UtcNow.AddDays(-10), true, false, DateTime.UtcNow.AddDays(-40)));
        await ctx.SaveChangesAsync();

        Assert.False((await new EntitlementService(ctx).GetAsync(uid)).IsPremium);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test --filter EntitlementServiceShadowTests`
Expected: FAIL on `An_active_sub_is_not_shadowed…` — the refunded sub (later `CurrentPeriodEnd`) is selected by `OrderByDescending`, fails `IsPremiumActive`, and the method returns Free. (`Returns_free_when_only_an_expired_sub_exists` passes already — it pins we didn't over-correct.)

- [ ] **Step 3: Filter to active candidates before ordering (minimal impl)**

Replace the query in `src/PokerApp.Infrastructure/Services/EntitlementService.cs` so only currently-premium subscriptions are considered, then pick the one ending latest:

```csharp
    public async Task<EntitlementDto> GetAsync(Guid userId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // Consider only subscriptions that grant premium right now (status allows it AND period not ended),
        // then take the latest-ending — so a refunded/expired sub with a far-future period end can never
        // shadow a genuinely active one. Mirrors Subscription.IsPremiumActive translated to a SQL predicate.
        var sub = await db.Subscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId
                && now <= s.CurrentPeriodEnd
                && (s.Status == SubscriptionStatus.Active
                    || s.Status == SubscriptionStatus.Grace
                    || s.Status == SubscriptionStatus.Canceled))
            .OrderByDescending(s => s.CurrentPeriodEnd)
            .FirstOrDefaultAsync(ct);

        if (sub is not null)
            return new EntitlementDto("premium", sub.Status.ToString().ToLowerInvariant(), sub.ProductId, sub.CurrentPeriodEnd);

        return EntitlementDto.Free;
    }
```

Add the enum `using` at the top of the file:

```csharp
using PokerApp.Domain.Enums;
```

> The `Where` predicate must mirror `Subscription.IsPremiumActive` exactly (statuses `Active`/`Grace`/`Canceled` and `now <= CurrentPeriodEnd`). `Canceled` still grants until period end (auto-renew off but paid through) — matching the domain method. Keep the post-filter `IsPremiumActive` out of the picture since the predicate now encodes it.

- [ ] **Step 4: Run test to verify it passes**

Run: `dotnet test --filter EntitlementServiceShadowTests`
Expected: PASS (2 tests).

- [ ] **Step 5: Regression — existing entitlement tests still green**

Run: `dotnet test --filter EntitlementServiceTests`
Expected: PASS (`NoSubscription_IsFree`, `ActiveSubscription_IsPremium_RefundedOrExpired_IsFree`).

- [ ] **Step 6: Build + full test gate**

Run: `dotnet build PokerApp.sln`
Expected: Build succeeded.
Run: `dotnet test`
Expected: all green.

- [ ] **Step 7: Commit**

```powershell
git add src/PokerApp.Infrastructure/Services/EntitlementService.cs src/PokerApp.Tests/EntitlementServiceShadowTests.cs
git commit -m @'
fix(billing): active subscription no longer shadowed by a later-ending refund

EntitlementService now filters to currently-premium subs (status +
period predicate mirroring IsPremiumActive) before taking the latest-
ending, so a refunded/expired sub with a far-future CurrentPeriodEnd
can no longer hide a genuinely active one. TDD red->green.
'@
```

---

## Task 9: PaywallScreen — lead with the live benefit, honest Soon chips, a11y (ui-ux-pro-max)

**Files:**
- Modify: `apps/poker-mobile/src/features/premium/ui/PaywallScreen.tsx`

> **REQUIRED SUB-SKILL for this task:** invoke `ui-ux-pro-max` (action: `improve`, project: mobile app, element: paywall) and apply its a11y-first checklist (spec §11): 4.5:1 contrast, focus order, `prefers-reduced-motion`, screen-reader labels, never color-only, ≥44×44 touch targets, semantic tokens only (no raw hex), SVG icons (Ionicons — no emoji), loading feedback on checkout, CLS<0.1 (reserve space), motion 150–300ms.
>
> Content correctness is already pinned by Task 2's `paywallContent.test.ts` (only `premium_study` is live; Soon features never become the CTA target; price fallback). This task is the visual/interaction implementation; gates are `tsc` + `expo export -p web` plus a manual reduced-motion + screen-reader pass.

- [ ] **Step 1: Lead with the live benefit + honest Soon ordering**

In `apps/poker-mobile/src/features/premium/ui/PaywallScreen.tsx`, render the feature list with `premium_study` first and visually distinguished as the live, included benefit (checkmark, full-opacity), and the rest as muted rows with a single consistent "Soon" chip. Drive "live vs soon" from the shared helper, NOT ad-hoc booleans:

```tsx
import { PRICING, PREMIUM_FEATURES, isFeatureLive, paywallPriceFor } from '../config';

// inside the features map:
{PREMIUM_FEATURES.map(f => {
  const live = isFeatureLive(f.key);
  return (
    <View key={f.key} style={styles.featureRow} accessible accessibilityRole="text"
      accessibilityLabel={live ? `${f.title}, included` : `${f.title}, coming soon`}>
      <View style={[styles.featureIcon, !live && styles.featureIconSoon]}>
        <Ionicons
          name={(live ? 'checkmark-circle' : f.icon) as React.ComponentProps<typeof Ionicons>['name']}
          size={18}
          color={live ? colors.gold : colors.textMuted}
        />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.featureTitleRow}>
          <Text style={[styles.featureTitle, !live && styles.featureTitleSoon]}>{f.title}</Text>
          {!live && <Chip label="Soon" tone="neutral" />}
        </View>
        <Text style={styles.featureDesc}>{f.desc}</Text>
      </View>
    </View>
  );
})}
```

Add the two muted styles to the `StyleSheet` (semantic tokens only):

```ts
  featureIconSoon: { backgroundColor: colors.surfaceHigh },
  featureTitleSoon: { color: colors.textMuted },
```

- [ ] **Step 2: Honest price via the shared helper (SDK-localized else config)**

Replace the local `priceFor` with the shared helper so the screen and tests use one rule:

```tsx
const priceFor = (p: 'yearly' | 'monthly') =>
  paywallPriceFor(p, products.find(pr => pr.id === PRICING[p].productId)?.price);
```

Keep the existing yearly-default toggle (`useState<'yearly' | 'monthly'>('yearly')`) and the "save 30%" sub line (`save ${PRICING.yearly.savePct}%`). Ensure the CTA only ever purchases the selected plan's `productId` (always a live product) — no Soon feature is ever a CTA target (already true; `isFeatureLive` guards content).

- [ ] **Step 3: a11y + touch + motion polish (apply ui-ux-pro-max output)**

Ensure: the plan toggle cards expose `accessibilityRole="radio"` + `accessibilityState={{ selected }}` and ≥44×44 hit area; the primary CTA shows `loading={purchasing}` feedback (already wired) and has an `accessibilityLabel` describing the charge; the active-state ring on the selected plan is not color-only (add a check/selected affordance); any entrance motion respects `prefers-reduced-motion` (use existing `components/motion` primitives, which already degrade on web). Replace any raw values with tokens from `theme/colors|spacing|radii|typography`.

- [ ] **Step 4: Content tests still green (no regressions)**

Run: `cd apps/poker-mobile && npx jest src/features/premium/__tests__`
Expected: PASS (honesty + content + selection suites).

- [ ] **Step 5: Gates**

Run: `cd apps/poker-mobile && npx tsc --noEmit`
Expected: no errors.
Run: `cd apps/poker-mobile && npx expo export -p web`
Expected: build succeeds.

- [ ] **Step 6: Manual a11y pass (record evidence in the PR)**

- Web: tab through the paywall — focus is visible and ordered (back → benefits → plan toggle → CTA → restore → legal).
- Toggle OS "reduce motion" — no large/animated entrance; content appears without motion.
- Screen reader (VoiceOver/TalkBack/web SR): each benefit announces "included" or "coming soon"; the CTA announces the price + plan.

- [ ] **Step 7: Commit**

```powershell
git add apps/poker-mobile/src/features/premium/ui/PaywallScreen.tsx
git commit -m @'
feat(premium): honest paywall — lead with Premium Study, Soon chips, a11y

Leads with the one live benefit (checkmark, full opacity, exact copy);
all other features muted with a single Soon chip and no CTA. Honest price
(SDK-localized else config), yearly default + save 30%. ui-ux-pro-max
a11y pass: focus order, reduced-motion, SR labels, 44x44, semantic
tokens, SVG icons, non-color-only selection.
'@
```

---

## Task 10: Document human actions + Stripe E2E (spec §12)

**Files:**
- Create: `docs/release/stripe-setup.md`
- Modify: `docs/release/prod-visible-changes.md` (append; create if absent)

- [ ] **Step 1: Write the Stripe setup + env + E2E doc**

Create `docs/release/stripe-setup.md` with these sections (fill with the concrete values/commands below — no placeholders):

```markdown
# Stripe Setup (Phase 2 — TEST mode for the launch gate)

> Money gate is SERVER-AUTHORITATIVE. Nothing is committed: all secrets live in Railway/Vercel env only.
> Premium is granted ONLY by the backend (Stripe webhook source-of-truth + /api/billing/verify-session
> fallback) — never client-side. Run the gate in Stripe TEST mode; the test->live switch is below.

## 1. Stripe dashboard (TEST mode)
1. Toggle **Test mode** (top-right) — do everything below in test mode first.
2. **Product:** Products -> Add product -> name "T Poker Premium".
3. **Prices:** add TWO recurring prices on that product:
   - Monthly — e.g. $11.99 / month -> copy the `price_…` id -> this is `PriceMonthlyId`.
   - Yearly — e.g. $99.99 / year -> copy the `price_…` id -> this is `PriceYearlyId`.
4. **Keys:** Developers -> API keys -> copy **Publishable key** (`pk_test_…`) and **Secret key** (`sk_test_…`).
5. **Webhook:** Developers -> Webhooks -> Add endpoint
   - URL: `https://<your-railway-domain>/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
   - Copy the **Signing secret** (`whsec_…`) -> this is `WebhookSecret`.

## 2. Environment variables
**Backend (Railway)** — nested keys use `__`:
- `StripeSettings__SecretKey = sk_test_…`
- `StripeSettings__WebhookSecret = whsec_…`
- `StripeSettings__PriceMonthlyId = price_…`
- `StripeSettings__PriceYearlyId = price_…`
- `BillingSettings__Provider = direct`   (selects the real Stripe verifier; default is mock)
- `AppSettings__WebBaseUrl = https://poker-home-games-three.vercel.app`  (success/cancel URLs)

**Client (Vercel)** — public key only (never a secret):
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_…`
- (optional, only if overriding the default product ids) `EXPO_PUBLIC_PREMIUM_MONTHLY_ID`,
  `EXPO_PUBLIC_PREMIUM_YEARLY_ID` — must equal the Stripe price ids above.

> Fail-closed: with `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` empty the client uses the mock provider; with
> `StripeSettings__SecretKey` empty the backend returns 400 on checkout and grants nothing.

## 3. E2E manual test (Stripe CLI, TEST mode)
Prereq: `stripe login` (Stripe CLI).
1. Forward live webhooks to the running backend (local or Railway):
   - Local: `stripe listen --forward-to localhost:5062/api/webhooks/stripe`
     Copy the `whsec_…` it prints into `StripeSettings__WebhookSecret` for the local run.
2. Start the app on web with `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` set; sign in.
3. Open the Paywall -> choose Annual -> Go Premium -> you are redirected to hosted Stripe Checkout.
4. Pay with a Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
5. On success you return to `/billing/success?session_id=cs_test_…`:
   - The app calls `POST /api/billing/verify-session` -> instant unlock (entitlement = premium).
   - Independently, `stripe listen` shows `checkout.session.completed` -> the webhook upserts the SAME
     subscription (idempotent — no second row, no double-grant).
6. Confirm `GET /api/entitlements` returns `{"plan":"premium",…}` and the app reflects premium.
7. Cancel test: `stripe trigger customer.subscription.deleted` (or cancel in dashboard) -> webhook ->
   entitlement returns to free after the period ends / on delete per status.

You can also drive events without the UI:
- `stripe trigger checkout.session.completed`
- `stripe trigger customer.subscription.deleted`

## 4. Test -> Live switch (when ready to charge real money)
1. In Stripe, toggle OFF test mode and recreate the Product + monthly/yearly Prices (or use existing live ones).
2. Create a LIVE webhook endpoint (same URL + events) -> new live `whsec_…`.
3. Swap env to the LIVE values: `sk_live_…`, live `price_…` ids, live `whsec_…` (Railway) and
   `pk_live_…` (Vercel). Redeploy. Never commit any of these.
4. Re-run the §3 E2E with a real card (small amount) once, then refund it in the dashboard and confirm the
   refund webhook drops the entitlement to free.
```

- [ ] **Step 2: Ledger the prod-visible change**

Append to `docs/release/prod-visible-changes.md` (create the file with an `# Prod-Visible Changes` heading if it does not exist):

```markdown
## 2026-06-25 — Paywall + Stripe (Phase 2)
- Live benefit: **Premium Study** (`premium_study`, `comingSoon:false`) appears on the Paywall; all other
  premium features show a "Soon" chip and are never charged (honesty gate; jest CI guard).
- Stripe web checkout live (TEST mode for the gate): hosted Checkout -> webhook grant (source of truth) +
  `POST /api/billing/verify-session` redirect fallback. Server-authoritative; client fail-closed.
- Fixed `EntitlementService` so an active subscription is no longer shadowed by a later-ending refund.
- **Reversible:** gated by the `paywall` flag and by env keys — clear `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  (client falls back to mock) / `StripeSettings__SecretKey` (server returns 400, grants nothing).
```

- [ ] **Step 3: Commit**

```powershell
git add docs/release/stripe-setup.md docs/release/prod-visible-changes.md
git commit -m @'
docs(release): Stripe setup, env, test->live switch, stripe listen E2E

Human actions for Phase 2 (spec §12): dashboard product+prices, Railway
StripeSettings__*/AppSettings__WebBaseUrl, Vercel publishable key, the
test->live switch, and a Stripe CLI `stripe listen` E2E. Ledger the
prod-visible paywall/Stripe change (reversible by flag/env).
'@
```

---

## Final verification (run all gates before declaring done)

- [ ] **Client typecheck:** `cd apps/poker-mobile && npx tsc --noEmit` → no errors.
- [ ] **Client tests:** `cd apps/poker-mobile && npx jest` → all green (honesty, content, selection suites included).
- [ ] **Web export:** `cd apps/poker-mobile && npx expo export -p web` → build succeeds.
- [ ] **Backend build:** `dotnet build PokerApp.sln` → Build succeeded.
- [ ] **Backend tests:** `dotnet test` → all green (new StripeCheckoutService, VerifyCheckoutSession, StripeWebhookGrant, EntitlementServiceShadow suites + existing billing suites).
- [ ] **Honesty confirmation:** exactly one `comingSoon:false` premium feature (`premium_study`); `solver` flag remains OFF (unchanged by this plan).
- [ ] **Manual E2E (when Stripe test keys exist):** follow `docs/release/stripe-setup.md` §3 — purchase via test card unlocks premium; duplicate webhook delivery does not double-grant.

---

## Self-review notes (coverage map vs spec §7 + §10 + §12)

- §7 client `premium_study` exact copy + others Soon → Task 1 (+ honesty guard).
- §10 / "jest HONESTY test (exactly one comingSoon:false = premium_study)" → Task 1.
- §7 stripeBillingProvider web flow (checkout → redirect → verify-session → refresh entitlements) → Tasks 4 + 6.
- §7 web selects Stripe when publishable key present, else mock (fail-closed) + tests → Task 3.
- §7 PaywallScreen (lead premium_study, Soon chips, yearly-default + save 30%, honest price, a11y) + tests → Tasks 2 + 9.
- §7 backend StripeCheckoutService (env price ids + success/cancel from WebBaseUrl) + test → Task 5 (service exists; test + userId metadata added).
- §7 webhook `/api/webhooks/stripe` idempotent upsert (duplicate ≠ double-grant) → Task 7 (handler EXISTS; extended to create+grant on first purchase; idempotency test added).
- §7 `POST /api/billing/verify-session` (retrieve session → idempotent upsert → return entitlement) + test → Task 6.
- §7 EntitlementService active-sub shadow fix (TDD red first) → Task 8.
- §12 human actions (dashboard, Railway/Vercel env, test→live) + `stripe listen` E2E → Task 10.
- Gates (`tsc`, `jest`, `dotnet build`, `dotnet test`, `expo export -p web`) → enforced per task + Final verification.
- Clean Architecture/CQRS (command+validator+handler, assembly-scanned, register nothing) → Task 6 (VerifyCheckoutSession) follows the `ValidatePurchaseCommand` pattern exactly; no manual DI registration added.
```