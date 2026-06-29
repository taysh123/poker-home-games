# Commercial Integration Boundaries (billing + AI vendor)

Where a **real** billing provider and a **real** AI vendor plug into T Poker. The abstraction seams already
exist and are clean — no app architecture change is needed to go live; the work is wiring a provider behind an
existing interface + the external setup (accounts/SDK/keys). The current mocks are **honestly labeled** and
must stay until the real provider is wired. **Nothing here is faked.**

## Billing / subscriptions
**Client seam:** `IBillingProvider` (`src/features/premium/types.ts`) — `{ getProducts(), purchase(productId),
restore() }`. Selected in `src/features/premium/providers/index.ts` (currently `mockBillingProvider`, which
always succeeds with config prices). `PremiumContext` (`state/PremiumContext.tsx`) drives the flow + persists a
local entitlement cache; `PaywallScreen` consumes `products` for display.

**Server seam (already built):** `BillingController` → `GET /api/entitlements` (`GetEntitlementQuery`),
`POST /api/billing/validate` (`ValidatePurchaseCommand` → `IBillingVerifier`). `EntitlementService` reads the
newest valid `Subscription` (fail-closed). `EntitlementsContext` is **server-authoritative** (`SERVER_AUTHORITATIVE
= true`) — the client cache is display-only, never authority.

**To go live (external-blocked):**
1. Implement `IBillingProvider` with **RevenueCat (recommended — wraps StoreKit + Play, receipts, restore)** or
   native StoreKit 2 / Google Play Billing. Register it in `providers/index.ts`. No UI change.
2. Implement server `IBillingVerifier` against Apple/Google (or RevenueCat webhooks) with **real store keys**.
3. App Store Connect + Play Console products matching `PRICING.*.productId`; sandbox testing.
4. `PaywallScreen` already renders provider-supplied (localized) prices when `getProducts()` returns them —
   replace the config fallback strings only as a last resort.
**Dependencies:** store developer accounts, signed builds (EAS), product config, store keys. **Until then:**
`paywall` flag stays OFF; the paywall flags every benefit `comingSoon`.

## AI coach vendor
**Client seam:** `ICoachProvider` (`src/features/coach/types.ts`) — `analyze(req) → CoachAnalysis`. Selected in
`coach/providers/index.ts`. With `SERVER_AUTHORITATIVE`, the live path always uses `serverCoachProvider`
(`POST /api/coach/analyze`); the client `mockCoachProvider` is the offline/demo path.

**Server seam (already built):** `ICoachAiProvider` (currently `MockCoachAiProvider`, `Id="mock-server"`) behind
`AnalyzeHandCommandHandler`, which enforces credits via `ICreditLedger.TryConsumeAsync` (atomic, idempotent,
refund-on-failure), rate limits, and an optional fraud hook. Credit policy from `IAiCreditPolicyProvider`.

**To go live (external-blocked):**
1. Implement server `ICoachAiProvider` with a real vendor (OpenAI / Anthropic / Gemini) — **API key server-side
   only, never on the client**. Map the vendor output into the structured `CoachAnalysisResult`.
2. Keep the structured-output + disclaimer contract; the credit ledger / rate limit / fraud enforcement are
   unchanged.
3. Retire the "Demo — Not Live AI Yet" banners (`CoachScreen`, `CoachResultScreen`) **only** once the real
   provider ships.
**Dependencies:** vendor account + API key + budget; prompt/guardrail design. **Until then:** the demo banner is
accurate and must stay; the paywall must not sell live AI (it currently labels AI Coach `comingSoon`).

## Honesty invariants (do not regress)
- Server is the single source of truth for entitlements + credits; the client cache never grants premium.
- Coach is a labeled demo until a real vendor is wired (banners are backend-accurate — server is a mock too).
- The paywall never presents an unshipped benefit as live (`comingSoon` + "Soon" chips).
- Grounded coach references surface only `safe_to_assert` claims and are not claimed hand-specific.

## Status
All seams in place + tested. Going live is **external setup**, not app re-architecture. Tracked as pre-flip
dependencies in `docs/release/v2-deployment-checklist.md`.
