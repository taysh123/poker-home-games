# Paddle Billing — Sandbox Setup & Task-10 E2E Checklist

Human setup guide for T Poker's Paddle Billing integration. Complete these steps in order.
All sandbox credentials are throwaway — they map 1:1 to live equivalents in the final section.

---

## 1. Paddle Dashboard (Sandbox)

**Sandbox is a completely separate account from live. Never mix credentials.**

### 1.1 Create sandbox account

Go to `https://sandbox-vendors.paddle.com/signup` and create a vendor account.
This is entirely separate from `vendors.paddle.com` (the live dashboard).

### 1.2 Set the Default payment link

Without a default payment link, no checkout works — Paddle requires one before any transaction.

1. Catalog → Products → Checkout settings → Payment links
2. Click "Add payment link" and enter any URL (e.g. `https://poker-home-games-three.vercel.app`)
3. Mark it as **Default**

### 1.3 Create the product + two prices

1. Catalog → Products → Create product
   - Name: **T Poker Premium**
   - Type: Software / SaaS
   - Tax category: Standard

2. Inside the new product, add **two Prices**:

   | Name | Billing cycle | Amount |
   |------|---------------|--------|
   | T Poker Premium Monthly | Monthly | USD 11.99 |
   | T Poker Premium Yearly  | Yearly  | USD 99.99 |

3. After saving, note the `pri_…` IDs for each price — you'll need both.

### 1.4 Get the client-side token

Developer Tools → Authentication → **Client-side tokens** → Generate new token.

Copy the `test_…` value once — this is `EXPO_PUBLIC_PADDLE_CLIENT_TOKEN`.
Safe to expose in the frontend bundle.

### 1.5 Get the API key

Developer Tools → Authentication → **API keys** → Generate new key.

Copy the `pdl_sdbx_apikey_…` value — this is shown **only once** at creation.
This is `Paddle__ApiKey` on Railway. Keep it secret.

### 1.6 Create a webhook destination

Developer Tools → Notifications → **New destination**

- URL: `https://<your-railway-domain>/api/webhooks/paddle`
  *(Replace `<your-railway-domain>` with the Railway URL of the deployed backend.)*
- Description: Sandbox webhook

Subscribe to these events:
- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `subscription.activated`
- `subscription.past_due`
- `transaction.completed`

Copy the **signing secret** (`pdl_ntfset_…`) — shown once.
This is `Paddle__WebhookSigningSecret` on Railway.

---

## 2. Env Vars — Where Each One Goes

### Backend — Railway

Set these via Railway → Project → Variables:

```
Paddle__ApiBaseUrl=https://sandbox-api.paddle.com
Paddle__ApiKey=<pdl_sdbx_apikey_…>
Paddle__WebhookSigningSecret=<pdl_ntfset_…>
Paddle__PriceMonthlyId=<pri_… monthly>
Paddle__PriceYearlyId=<pri_… yearly>
```

### Frontend — Vercel

Set these via Vercel → Project → Settings → Environment Variables:

```
EXPO_PUBLIC_PADDLE_CLIENT_TOKEN=<test_…>
EXPO_PUBLIC_PADDLE_ENVIRONMENT=sandbox
EXPO_PUBLIC_PREMIUM_MONTHLY_ID=<pri_… monthly>
EXPO_PUBLIC_PREMIUM_YEARLY_ID=<pri_… yearly>
```

### Flip the paywall flag ON

In `apps/poker-mobile/src/config/features.ts`, add `paywall` to `PROD_FLAGS`
(or the beta overrides map) so the paywall UI is reachable during testing.
This flag controls the HONESTY GATE — only flip it when ready to test real billing.

**SECRETS NEVER GO IN CODE OR CHAT.** Both the API key and signing secret are server-only;
the client-side token is safe but also not committed to source.

---

## 3. Order of Operations — Sandbox E2E

1. **Deploy backend with env vars** — Railway redeploy after setting `Paddle__*` vars.
2. **Set webhook URL** in Paddle sandbox dashboard to the Railway URL + `/api/webhooks/paddle`.
   Use Paddle's "Test webhook" to confirm the endpoint returns 200.
3. **Deploy frontend with env vars** — Vercel rebuild after setting `EXPO_PUBLIC_PADDLE_*` vars.
   Confirm `EXPO_PUBLIC_PADDLE_ENVIRONMENT=sandbox` is set.
4. **Flip the paywall flag ON** (see §2 above), commit, redeploy.
5. **Open the paywall** in a web browser at the Vercel domain. Confirm:
   - Premium Study shows with a gold icon (live feature, no "Soon" chip).
   - AI Coach / Cloud Sync / Advanced Bankroll show with "Soon" chips and no per-feature CTA.
   - Plan toggle defaults to Annual. "Best value" badge on Annual card.
   - CTA label shows `Go Premium — $99.99/yr`.
6. **Buy with a Paddle test card** (`4242 4242 4242 4242`, any future expiry, any CVC).
   The Paddle overlay should open inside the page (dark theme).
7. **Confirm the overlay closes** and the PaywallScreen shows the "completing" pending state
   (because `purchase()` returns `pending_verification` until the server grants it).
8. **Confirm webhook delivered + signature verified:**
   - Check Railway logs for `POST /api/webhooks/paddle` → 200.
   - Paddle dashboard → Developer Tools → Notifications → your destination → Logs: confirm
     `subscription.created` and `transaction.completed` events appear as delivered.
9. **Tap "I've completed payment — activate"** on the pending state card.
   Confirm the app calls `GET /api/entitlements` via restore(), gets `plan: premium`,
   and navigates back showing premium state.
10. **Confirm entitlement granted** — navigate to Home/Stats; the premium study feature should
    be accessible without an upgrade prompt.

Test card reference:
- `4242 4242 4242 4242` — succeeds, no 3DS
- `4000 0038 0000 0446` — triggers 3DS challenge
- `4000 0000 0000 0002` — declines

---

## 4. PADDLE-VERIFY Flags — Shapes to Confirm Against Real Sandbox Payloads

These comments mark code assumptions inferred from Paddle's docs rather than captured sandbox
events. Verify each against a real sandbox session before trusting them in production.

### Backend C# — webhook + verifier

| # | What to verify | File:Line |
|---|---------------|-----------|
| 1 | Webhook event JSON shapes unconfirmed — test stubs use research-doc shapes, not real events | `src/PokerApp.Tests/PaddleWebhookGrantTests.cs:21` |
| 2 | GET /transactions/{id} response shape unconfirmed — test uses research-doc JSON | `src/PokerApp.Tests/PaddleBillingVerifierTests.cs:16` |
| 3 | Create-transaction response: `data.checkout.url` + `data.id` field names and nesting | `src/PokerApp.Application/Common/Interfaces/IPaddleCheckoutService.cs:6` |
| 4 | Webhook event nesting: confirm `data` is the unwrapped entity (not double-nested) | `src/PokerApp.Infrastructure/Billing/StoreNotificationVerifier.cs:124` |
| 5 | `custom_data` location: confirm it sits at the `data` root on both `subscription.*` and `transaction.*` | `src/PokerApp.Infrastructure/Billing/StoreNotificationVerifier.cs:131` |
| 6 | `event_type` string spellings + `scheduled_change` field shape against captured events | `src/PokerApp.Infrastructure/Billing/StoreNotificationVerifier.cs:182` |
| 7 | Webhook `Paddle-Signature` header format: `ts=<unix>;h1=<hex>` (semicolon-separated) | `src/PokerApp.Infrastructure/Billing/PaddleSignature.cs:15` |
| 8 | Create-transaction request body: `items[].price_id` is snake_case in the REST API | `src/PokerApp.Infrastructure/Billing/PaddleCheckoutService.cs:34` |
| 9 | Create-transaction response parsing: `data.checkout.url` + `data.id` (txn_…) nesting | `src/PokerApp.Infrastructure/Billing/PaddleCheckoutService.cs:57` |
| 10 | GET /transactions/{id}: field names and nesting in the response body | `src/PokerApp.Infrastructure/Billing/PaddleBillingVerifier.cs:17` |
| 11 | Transaction status enum: full set of values (created / paid / completed / billed / canceled / …) | `src/PokerApp.Infrastructure/Billing/PaddleBillingVerifier.cs:39` |

### Frontend TS — Paddle.js

| # | What to verify | File:Line |
|---|---------------|-----------|
| 12 | Paddle.js CDN URL for v2: `https://cdn.paddle.com/paddle/v2/paddle.js` | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:61` |
| 13 | `window.Paddle` is populated synchronously after `script.onload` fires | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:68` |
| 14 | `Paddle.Checkout.open({ transactionId })` is synchronous (no Promise return) | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:39` |
| 15 | Method name is `Initialize` with capital I (not `initialize`) | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:53` |
| 16 | `Environment.set('sandbox')` must be called BEFORE `Initialize` | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:34` |
| 17 | `'sandbox'` is the exact string literal for the sandbox environment (not `'test'` or `'development'`) | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:171` |
| 18 | `Initialize` is idempotent — safe to call multiple times (e.g. on re-purchase) | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:177` |
| 19 | `?_ptxn=` is the correct query param key in the checkout URL (Option B fast path) | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:105` |
| 20 | Backend returns `transactionId` in the JSON body vs only via URL `?_ptxn=` param | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:154` |
| 21 | Checkout overlay settings: `displayMode: 'overlay'` and `theme: 'dark'` are valid values | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:184` |
| 22 | Paddle.js v2 method signatures match the interface typed at line 31 | `apps/poker-mobile/src/features/premium/providers/paddleBillingProvider.ts:31` |

### From research doc — no code annotation yet

| # | What to verify |
|---|---------------|
| 23 | Replay tolerance: 5-second window for webhook timestamps — may need widening for clock skew |
| 24 | Raw-body in ASP.NET Core: `[FromBody]` does NOT work; `EnableBuffering` + `PipeReader` required |
| 25 | No official .NET/C# Paddle SDK exists — confirm still true before shipping |
| 26 | `pwCustomer` param in `Paddle.Initialize` — not used; confirm not required for basic subscriptions |
| 27 | `transaction.paid` vs `transaction.completed` timing — confirm both events arrive and that `transaction.completed.data.subscription_id` is populated |
| 28 | Israel as Paddle seller country — confirm eligibility during live account verification |

---

## 5. Switching from Sandbox to Live

Everything must be recreated in the live Paddle account — IDs, keys, and secrets do NOT carry over.

1. Create a **live Paddle account** at `https://vendors.paddle.com`.
2. Complete business verification and add a bank account.
3. Verify the default payment link domain (Paddle requires domain verification for live checkouts).
4. Re-create the product + 2 prices → note new `pri_…` IDs.
5. Generate a new **live API key** (`pdl_live_apikey_…`).
6. Generate a new **live client-side token** (`live_…`).
7. Create a new **live webhook destination** → new signing secret (`pdl_ntfset_…`).
8. Update Railway vars:
   ```
   Paddle__ApiBaseUrl=https://api.paddle.com
   Paddle__ApiKey=<pdl_live_apikey_…>
   Paddle__WebhookSigningSecret=<new live pdl_ntfset_…>
   Paddle__PriceMonthlyId=<live pri_… monthly>
   Paddle__PriceYearlyId=<live pri_… yearly>
   ```
9. Update Vercel vars:
   ```
   EXPO_PUBLIC_PADDLE_CLIENT_TOKEN=<live_…>
   EXPO_PUBLIC_PADDLE_ENVIRONMENT=   (remove this var entirely — omitting it defaults to production)
   EXPO_PUBLIC_PREMIUM_MONTHLY_ID=<live pri_… monthly>
   EXPO_PUBLIC_PREMIUM_YEARLY_ID=<live pri_… yearly>
   ```
10. Do NOT call `Paddle.Environment.set('sandbox')` in the live build.
    The code gates on `BILLING_KEYS.paddleEnvironment === 'sandbox'` — removing the env var
    means that branch is never reached and `Initialize` runs in production mode.


---

## Verification status - 2026-06-28 (against REAL sandbox payloads)

Captured real sandbox events (a checkout with test card 4242 + an immediate cancel, via the Paddle.js overlay
test page; payloads read from Paddle > Developer Tools > Notifications) and diffed them against our parsers.

**Confirmed correct (no change needed):**
- Webhook envelope: event_id / event_type / occurred_at / notification_id / data
- Subscription id: data.id on subscription.*; data.subscription_id on transaction.*
- User link: data.custom_data.app_user_id at the data root (all event types)
- Price: data.items[0].price.id; checkout: data.checkout.url (with ?_ptxn=) + transaction data.id
- Status: subscription active/canceled, transaction completed; grant (created/completed) + revoke (canceled) mapping
- Immediate cancel fires BOTH subscription.canceled AND subscription.updated(status canceled) -> both revoke
- verify-session (PaddleBillingVerifier) reads data.billing_period on the transaction
- Client Paddle.js (Environment.set('sandbox'), Initialize({token}), Checkout.open({items,customData}),
  checkout.completed callback, CDN v2) - all exercised end-to-end by the overlay checkout completing

**Fixed (commits ff5caa1, 4ab4bd6):**
- Webhook period field: read only current_billing_period (the subscription.* shape); transaction.* carries the
  period at billing_period, so transaction.completed yielded a null period. Now reads whichever the event carries;
  pinned by the webhook tests. dotnet 155 tests green.

**STILL PENDING (the ONLY remaining item) - confirm at the runtime E2E:**
- Paddle-Signature HMAC: confirm a REAL signed webhook delivery verifies (HTTP 200), not 401. The format
  (ts=..;h1=..) is implemented + unit-tested (PaddleSignatureTests); only a live delivery to our endpoint proves
  the end-to-end signature. (Cancel shapes/scheduled_change + status enum are now covered/fail-safe; the
  POST /transactions create-response is confirmed by shape via the transaction object.)

## Runtime E2E - how to resume later (closes the last item)

The branch must run where Paddle can deliver the webhook (prod `main` lacks the billing code -> 404). Two ways,
both with NOTHING merged to main:

### Option A - local backend + ngrok (recommended; nothing deployed)
1. src/PokerApp.API/appsettings.Development.json (gitignored): add a "Paddle" section with the sandbox values
   (ApiBaseUrl=https://sandbox-api.paddle.com, ApiKey, WebhookSigningSecret, PriceMonthlyId, PriceYearlyId),
   set "BillingSettings": { "AcceptSandbox": true }, and a working ConnectionStrings:DefaultConnection
   (local Postgres, or the Railway DB connection string).
2. cd src/PokerApp.Infrastructure; dotnet ef database update --startup-project ../PokerApp.API   (if DB is fresh)
3. cd src/PokerApp.API; dotnet run --launch-profile http   (serves :5062)
4. ngrok http 5062   -> copy the https URL
5. Paddle > the webhook destination > temporarily change the URL to https://<ngrok>/api/webhooks/paddle (save)
6. cd apps/poker-mobile; npm run web   (dev build: paywall + immersive ON; web points at localhost:5062).
   Ensure apps/poker-mobile/.env has EXPO_PUBLIC_PADDLE_CLIENT_TOKEN, EXPO_PUBLIC_PADDLE_ENVIRONMENT=sandbox,
   EXPO_PUBLIC_PREMIUM_MONTHLY_ID, EXPO_PUBLIC_PREMIUM_YEARLY_ID.
7. In the app: open the paywall -> buy Monthly -> Paddle overlay -> test card 4242 4242 4242 4242 -> complete.
8. CONFIRM: the backend logs POST /api/webhooks/paddle returning 200 (PaddleSignature verified), a Subscription
   row is created, and GET /api/entitlements returns premium.
9. Revert the Paddle webhook URL back to the Railway prod URL.

### Option B - Railway/Vercel staging (deployed branch; no main merge)
1. Railway: a service/environment that builds feature/launch-phase-1-2 (NOT main); set the Paddle__* env +
   AcceptSandbox; needs Postgres + migrations. Get its URL.
2. Vercel: a branch preview deploy with the EXPO_PUBLIC_PADDLE_* env.
3. Point the Paddle webhook URL at the staging Railway /api/webhooks/paddle; flip `paywall` ON for that build.
4. Buy with 4242 -> confirm signature verify + grant. Revert the webhook URL + flag afterwards.

### Config gotchas
- BillingSettings:AcceptSandbox MUST be true wherever you run it (the verify-session path rejects a sandbox sub
  otherwise; the webhook create path grants regardless - keep them consistent).
- The webhook URL must point at the host running THIS branch (main returns 404 on /api/webhooks/paddle).
- Paddle checkout is active only when Paddle:ApiKey + both price ids are configured (else it falls back to
  Stripe/mock, fail-closed).
- Everything is behind the `paywall` flag - prod is byte-identical until you flip it ON.