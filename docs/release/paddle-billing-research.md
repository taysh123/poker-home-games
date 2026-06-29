# Paddle Billing — Subscription Integration Research

**Scope:** Integrating recurring **subscriptions** via **Paddle Billing** (the current API — NOT legacy "Paddle Classic") into a **.NET 8 backend** + **Expo / React-Native-web frontend**. Paddle is a **Merchant of Record (MoR)**, so it handles sales tax/VAT and works for sellers based in Israel.

**Researched:** 2026-06-28 against the official docs at `developer.paddle.com`. Every claim is cited inline. Anything not verifiable with high confidence is collected in the [VERIFY AGAINST SANDBOX](#-verify-against-sandbox) section at the end — treat those as "probably right, confirm on a real sandbox before shipping."

**Three distinct credentials (do not confuse them):**

| Credential | Prefix | Where it's used | Secrecy |
|---|---|---|---|
| **API key** (server) | `pdl_live_apikey_…` / `pdl_sdbx_apikey_…` | Backend → Paddle REST API (`Authorization: Bearer`) | **Secret** — server only |
| **Client-side token** | `live_…` / `test_…` | Frontend → Paddle.js (`Paddle.Initialize({ token })`) | Safe to expose in client code |
| **Webhook signing secret** | `pdl_ntfset_…` | Backend → verify `Paddle-Signature` on incoming webhooks | **Secret** — server only |

---

## 1. Checkout (subscriptions)

There are **two ways** to open a subscription checkout. Both ultimately render the same Paddle.js checkout.

### What identifies the thing being sold: `price_id`

Paddle's catalog hierarchy is **Product → Price**. A checkout/transaction always references **prices** (`pri_…`), never products directly. The product (`pro_…`) is the parent grouping.

- **Monthly vs yearly = two separate Price IDs under one Product.** You create one Product (e.g. "T Poker Pro") with (at least) two Prices: a monthly price and a yearly price, each with its own `billing_cycle` (`interval` + `frequency`). The frontend chooses which `priceId` to pass.
- A single checkout's recurring items **must share the same billing interval** — you cannot mix a monthly and a yearly price in one checkout.

Sources: [Paddle.Checkout.open()](https://developer.paddle.com/paddle-js/methods/paddle-checkout-open/), [Create a transaction (API)](https://developer.paddle.com/api-reference/transactions/create-transaction)

### Option A — Client-only overlay/inline checkout via Paddle.js (simplest)

Pass `items` (array of `{ priceId, quantity }`) directly to `Paddle.Checkout.open()`. No server round-trip needed to *open* the checkout.

```javascript
// items-based checkout (overlay)
Paddle.Checkout.open({
  settings: {
    displayMode: "overlay",      // "overlay" | "inline"
    theme: "dark",               // "light" | "dark"
    locale: "en",
    successUrl: "https://app.example.com/billing/success"
  },
  items: [
    { priceId: "pri_01gm81eqze2vmmvhpjg13bfeqg", quantity: 1 }
  ],
  customData: { app_user_id: "OUR-USER-GUID" },   // see section 2
  customer: { email: "jo@example.com" }            // or { id: "ctm_…" } for a known customer
});
```

**`Paddle.Checkout.open()` top-level parameters** (verbatim from the method reference):

| Param | Type | Notes |
|---|---|---|
| `settings` | object | General checkout settings (see below) |
| `items` | array | `[{ priceId, quantity }]` — at least one required (unless using `transactionId`) |
| `transactionId` | string | Open an **existing** transaction (`txn_…`) instead of `items` — Option B |
| `customer` | object | Pass `{ id: "ctm_…" }` for a known customer **or** `{ email }` for a new one |
| `address` | object | Customer address |
| `business` | object | Customer business info |
| `customData` | object | Your key-value metadata (camelCase in Paddle.js) — see section 2 |
| `discountCode` / `discountId` | string | Prefill a discount |
| `customerAuthToken` | string | Auth token for a specific customer |
| `savedPaymentMethodId` | string | Paddle ID of a saved payment method |

**`settings` object fields** (verbatim):

| Field | Default | Values |
|---|---|---|
| `displayMode` | `overlay` | `inline`, `overlay` |
| `variant` | `multi-page` | `one-page`, `multi-page`, `express` |
| `theme` | `light` | `light`, `dark` |
| `locale` | browser default | `en`, `fr`, `de`, `es`, … |
| `successUrl` | null | HTTP(S) URL Paddle redirects to after success |
| `allowLogout` | `true` | Allow buyer to change email at checkout |
| `allowedPaymentMethods` | null | `card`, `paypal`, `apple_pay`, … |
| `frameTarget` | null | CSS class of the target `<div>` (inline mode) |
| `frameInitialHeight` | null | Pixel height as string, e.g. `"450"` (inline mode) |
| `frameStyle` | null | CSS for the checkout `<div>` (inline mode) |

> **You pass either `items` OR `transactionId`, not both.**

Sources: [Paddle.Checkout.open()](https://developer.paddle.com/paddle-js/methods/paddle-checkout-open/), [Build an overlay checkout](https://developer.paddle.com/build/checkout/build-overlay-checkout)

### Option B — Server-side "create transaction → get checkout URL"

Create a transaction from the backend, then either (a) hand the returned `checkout.url` to the client, or (b) pass the `transactionId` to `Paddle.Checkout.open()`.

- **Endpoint:** `POST /transactions` (base URL per environment — section 5).
- **Request body (key fields):**
  - `items` (required): `[{ price_id: "pri_…", quantity: 1 }]` — note **`price_id` (snake_case)** in the REST API vs **`priceId` (camelCase)** in Paddle.js.
  - `customer_id` (optional): `ctm_…`
  - `custom_data` (optional): your metadata (see section 2)
  - `collection_mode` (default `automatic`): `automatic` (checkout/auto-charge) or `manual` (invoicing). For self-serve subscriptions you want `automatic`.
  - `currency_code` (optional): ISO 4217.
- **Response:** includes a `checkout` object with a **`url`** field. For automatically-collected transactions the URL is generated automatically; it is composed of **your default payment link** + `?_ptxn=<transaction_id>`. Example: `https://app.example.com/checkout?_ptxn=txn_01h0j589qt1nee24210teqtz57`.

When the buyer lands on a page that includes Paddle.js with `?_ptxn=…` in the URL, Paddle.js auto-opens the checkout for that transaction. Equivalent explicit call:

```javascript
Paddle.Checkout.open({
  settings: { theme: "dark", locale: "en" },
  transactionId: "txn_01h0j589qt1nee24210teqtz57"
});
```

> **Hard requirement for ANY checkout (both options):** you must set a **Default payment link** in the dashboard under **Paddle → Checkout → Checkout settings → Default payment link**. On **live** it must be an approved, domain-verified real URL (not `localhost`); on **sandbox** any domain works without verification.

**When to prefer Option B:** when you want the backend to control/validate the purchase (e.g. attach `custom_data` server-side so the client can't tamper with it, apply server-decided discounts, or pre-create the customer). Otherwise Option A is fewer moving parts.

Sources: [Pass a transaction to a checkout](https://developer.paddle.com/build/transactions/pass-transaction-checkout/), [Create a transaction (API)](https://developer.paddle.com/api-reference/transactions/create-transaction)

---

## 2. Linking a checkout to OUR user — `custom_data`

**Mechanism:** attach our app's user id as **custom data** on the checkout/transaction. Paddle copies it onto the subscription, and it surfaces in every related webhook so we can grant entitlements to the right account.

- **Field name differs by surface:**
  - **Paddle.js:** `customData` (camelCase) — passed to `Paddle.Checkout.open({ customData: {...} })`.
  - **REST API + webhook payloads:** `custom_data` (snake_case).
- **Format:** must be valid JSON with **at least one key**.
- **Propagation:** "Any custom data against a checkout is against the related transaction. If a checkout is for recurring items, it's stored against the created subscription, too." So set it once at checkout and it lands on **both** the `transaction` and the `subscription`.
- **Where it appears in webhooks:** at the **root of `data`** — i.e. `data.custom_data` on `subscription.*` events and `transaction.*` events.

```javascript
// Paddle.js — recommended: store our internal user id
Paddle.Checkout.open({
  items: [{ priceId: "pri_…", quantity: 1 }],
  customData: { app_user_id: "3f9a…-our-guid" }
});
```

```jsonc
// How it comes back on a webhook (data root)
"data": { "id": "sub_…", "custom_data": { "app_user_id": "3f9a…-our-guid" }, /* … */ }
```

> **Entities that support `custom_data`:** products, prices, discounts, transactions, subscriptions, customers, addresses, businesses.

> **Security tip:** if you don't want the client to be able to set/spoof `app_user_id`, use **Option B** (create the transaction server-side with `custom_data` attached) rather than passing it from Paddle.js. Also store Paddle's `customer_id` (`ctm_…`) against your user on first webhook so future events can be matched by customer even if `custom_data` is ever missing.

Sources: [Custom data (API reference)](https://developer.paddle.com/api-reference/about/custom-data), [Work with custom data](https://developer.paddle.com/build/transactions/custom-data), [Paddle.Checkout.open()](https://developer.paddle.com/paddle-js/methods/paddle-checkout-open/)

---

## 3. Webhooks / events — the source of truth for entitlements

### Webhook envelope (every event)

Every webhook is a JSON object with the same top-level shape:

| Field | Meaning |
|---|---|
| `event_id` | Unique ID for the **event**, prefixed `evt_` (pattern `^evt_[a-z\d]{26}$`). **Use this as the idempotency / dedupe key.** |
| `event_type` | `entity.action`, e.g. `subscription.created`, `transaction.completed` |
| `occurred_at` | RFC 3339 timestamp of when the event occurred (use for ordering, not arrival time) |
| `notification_id` | Unique ID for **this delivery attempt**, prefixed `ntf_` (pattern `^ntf_[a-z\d]{26}$`). Differs per destination/retry; do NOT dedupe on this. |
| `data` | The new/changed entity (full subscription or transaction object) |

- **Delivery is at-least-once** → you can receive the same `event_id` more than once → **dedupe on `event_id`**.
- Paddle retries if your endpoint doesn't return **HTTP 200 within 5 seconds**. (Sandbox: 3 retries / 15 min; Live: 60 retries / 3 days.) Respond 200 fast, process async if needed.

Sources: [How webhooks work](https://developer.paddle.com/webhooks/about/how-webhooks-work/), [Webhooks overview](https://developer.paddle.com/webhooks/overview)

### Subscription status enum (verbatim — the values we branch on)

From the Subscription entity reference, `status` is one of:

| `status` | Meaning | Grant access? |
|---|---|---|
| `active` | Billing normally | **Yes** |
| `trialing` | In trial | **Yes** (treat as active) |
| `past_due` | Payment overdue; Paddle Retain is dunning | **Yes** (keep access, show a "fix payment" banner) |
| `paused` | Paused; no transactions created | **No** (or read-only) |
| `canceled` | Canceled | **No** (revoke once `scheduled_change.effective_at` passes) |

> The subscription item objects also have a `status` of `active` / `inactive` / `trialing` — distinct from the subscription-level status.

Sources: [Get a subscription](https://developer.paddle.com/api-reference/subscriptions/get-subscription), [subscription.updated](https://developer.paddle.com/webhooks/subscriptions/subscription-updated/), [Provision access](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/)

### `subscription.created`

- **`event_type`:** `subscription.created`
- Fires when a new subscription is created. Use it to **save `customer_id` + `subscription_id` against your user and grant access.**
- **Key `data` fields:** `id` (`sub_…`), `status`, `customer_id` (`ctm_…`), `address_id` (`add_…`), `business_id` (nullable), `currency_code`, `started_at`, `first_billed_at`, `next_billed_at`, `current_billing_period.{starts_at,ends_at}`, `billing_cycle.{interval,frequency}`, `items[].price.id` (`pri_…`), `items[].price.product_id`/`items[].product.id` (`pro_…`), `items[].status`, `items[].quantity`, **`custom_data`**, and a `transaction_id` (the transaction that triggered creation — unique to this event, useful for matching with `transaction.*`).

Source: [subscription.created](https://developer.paddle.com/webhooks/subscriptions/subscription-created/)

### `subscription.updated`

- **`event_type`:** `subscription.updated`
- **Catch-all.** Fires for renewals, upgrades/downgrades, billing-detail changes, scheduled-change create/remove, and any status transition without a dedicated event. Per docs: *"You don't need to listen for separate events for renewals, upgrades or downgrades, or status changes. `subscription.updated` covers them all."* It can also fire **immediately after** a dedicated event (e.g. `subscription.activated`/`subscription.canceled`) when Paddle finishes updating fields.
- **Key `data` fields:** same entity as above. Watch `status`, `current_billing_period.ends_at` (current period end — what you cache as "access valid until"; `null` for paused/canceled), `next_billed_at`, and `scheduled_change` (object `{ action: "cancel"|"pause"|"resume", effective_at, resume_at }` or `null`).

Source: [subscription.updated](https://developer.paddle.com/webhooks/subscriptions/subscription-updated/)

### `subscription.canceled`

- **`event_type`:** `subscription.canceled`
- Fires when status changes to `canceled`. `data.status` = `"canceled"`, `data.canceled_at` set (RFC 3339). If the user scheduled a cancel for end-of-period, a `scheduled_change` with `action: "cancel"` exists until `effective_at`, at which point status flips to `canceled`. **Revoke access** when effectively canceled.

Source: [subscription.canceled](https://developer.paddle.com/webhooks/subscriptions/subscription-canceled/)

### `transaction.completed` (and `transaction.paid`)

- **`event_type`:** `transaction.completed` — `data.status` = `"completed"`.
- Event sequence for an auto-collected purchase:
  - `transaction.created` → transaction generated.
  - `transaction.paid` → *"fully paid, but has not yet been processed internally."*
  - `transaction.completed` → *"fully paid and processed"* — Paddle has logged payment, added fees/earnings, **created the subscription for recurring items**, and generated the invoice number.
- **Recommended provisioning trigger for one-time confirmation:** `transaction.completed` (payment confirmed **and** subscription exists). For subscription lifecycle, rely on `subscription.*` events.
- **Key `data` fields:** `id` (`txn_…`), `status`, `subscription_id` (`sub_…`), `customer_id` (`ctm_…`), `items[]` (with price/quantity/proration), `details` (`totals`, `line_items`, `tax_rates_used`, `payout_totals`), **`custom_data`**.

Sources: [transaction.completed](https://developer.paddle.com/webhooks/transactions/transaction-completed/), [Provisioning access](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/)

### Other lifecycle events worth subscribing to

`subscription.activated` (first time it becomes active — e.g. trial converts), `subscription.trialing`, `subscription.paused`, `subscription.resumed`, `subscription.past_due`. The provisioning guide recommends: created→grant, updated→refresh cached fields, paused→restrict, canceled→revoke, past_due→keep access + show recovery banner.

Source: [Provision access and handle subscription state](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/)

### Representative webhook payload skeleton (subscription.created)

> The `data` body below is a real Subscription entity shape from the GET-subscription docs; the **envelope wrapper** (`event_id`/`event_type`/`occurred_at`/`notification_id`) is composed from the documented envelope spec. Confirm exact nesting against a live sandbox event. `custom_data` shown populated to illustrate our user link.

```jsonc
{
  "event_id": "evt_01h8…",
  "event_type": "subscription.created",
  "occurred_at": "2024-04-12T10:38:00.901Z",
  "notification_id": "ntf_01h8…",
  "data": {
    "id": "sub_01hv8y5ehszzq0yv20ttx3166y",
    "status": "active",                       // active | trialing | past_due | paused | canceled
    "customer_id": "ctm_01hv8wt8nffez4p2t6typn4a5j",
    "address_id": "add_01hv8y4jk511j9g2n9a2mexjbx",
    "business_id": null,
    "currency_code": "USD",
    "created_at": "2024-04-12T10:38:00.761Z",
    "updated_at": "2024-04-12T10:38:00.761Z",
    "started_at": "2024-04-12T10:37:59.556997Z",
    "first_billed_at": "2024-04-12T10:37:59.556997Z",
    "next_billed_at": "2024-05-12T10:37:59.556997Z",
    "paused_at": null,
    "canceled_at": null,
    "current_billing_period": {
      "starts_at": "2024-04-12T10:37:59.556997Z",
      "ends_at": "2024-05-12T10:37:59.556997Z"   // <-- cache as "access valid until"
    },
    "billing_cycle": { "frequency": 1, "interval": "month" },
    "scheduled_change": null,                  // or { action, effective_at, resume_at }
    "items": [
      {
        "status": "active",
        "quantity": 1,
        "recurring": true,
        "price": {
          "id": "pri_01gsz8x8sawmvhz1pv30nge1ke",      // <-- the price purchased
          "product_id": "pro_01gsz4t5hdjse780zja8vvr7jg"
        }
      }
    ],
    "custom_data": { "app_user_id": "3f9a…-our-guid" }, // <-- our user link
    "transaction_id": "txn_01hv8x…"            // present on subscription.created
  }
}
```

---

## 4. Webhook signature verification (implement in C#)

Paddle signs every webhook with the **notification destination's signing secret** (prefix **`pdl_ntfset_…`**, e.g. `pdl_ntfset_01gkpjp8bkm3tm53kdgkx6sms7_6h3qd3uFSi9YCD3OLYAShQI90XTI5vEI`). Each destination has its own secret; store it in an env var.

### The `Paddle-Signature` header

Format (semicolon-separated key=value pairs):

```
Paddle-Signature: ts=1671552777;h1=eb4d0dc8853be92b7f063b9f3ba5233eb920a09459b6e6b2c26705b4364db151
```

- `ts` = Unix timestamp (seconds).
- `h1` = the HMAC-SHA256 signature (hex). (There may be multiple `hN` entries during key rotation.)

### Algorithm (precise enough to implement in C#)

1. **Read the RAW request body as bytes/string — do NOT deserialize-then-reserialize.** Even adding whitespace breaks the signature. In ASP.NET Core this means reading the body **before** model binding (e.g. `[FromBody]` is fatal here): enable buffering / read the stream into a string and keep it.
2. **Parse the `Paddle-Signature` header:** split on `;`, then each part on `=`, to get `ts` and `h1`.
3. **Build the signed payload string:** `signedPayload = ts + ":" + rawBody` (timestamp, a literal colon, then the raw body string).
4. **Compute HMAC-SHA256** over `signedPayload` (UTF-8 bytes) using the destination's **signing secret** (`pdl_ntfset_…`) as the key. Hex-encode the result (lowercase).
5. **Constant-time compare** your computed hex against `h1`. If they differ → reject (HTTP 4xx, do not process).
6. **Replay protection:** check that `ts` is within the allowed tolerance of "now". Paddle's SDK helpers default to a **5-second** tolerance. (See VERIFY note — for real servers with clock skew you may widen this; confirm Paddle's current recommendation.)

C# building blocks: read raw body via `HttpRequest.Body` (with `EnableBuffering()` or a custom read), compute with `System.Security.Cryptography.HMACSHA256`, hex-encode with `Convert.ToHexString(...).ToLowerInvariant()`, and compare with `CryptographicOperations.FixedTimeEquals(...)` (the C# equivalent of Node's `crypto.timingSafeEqual`).

Paddle's documented Node reference uses `timingSafeEqual(Buffer.from(hashedPayload), Buffer.from(signature))`. Official SDKs (Node, Go, PHP, Python) ship a one-call verifier; **there is no official .NET SDK**, so this must be implemented by hand in C# (see VERIFY note).

Sources: [Verify webhook signatures](https://developer.paddle.com/webhooks/about/signature-verification/)

---

## 5. Server API auth + base URLs

### Base URLs

| Environment | REST API base URL |
|---|---|
| **Sandbox** | `https://sandbox-api.paddle.com` |
| **Live** | `https://api.paddle.com` |

Sandbox keys work **only** against the sandbox URL; live keys **only** against the live URL.

### Server authentication (API key, Bearer)

- Header: `Authorization: Bearer pdl_live_apikey_…` (or `pdl_sdbx_apikey_…` for sandbox).
- **API key format:** 69 chars, five underscores, pattern `^pdl_(live|sdbx)_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$` — i.e. `pdl_<env>_apikey_<26-id>_<22-secret>_<3-checksum>`. Case-sensitive.
- Get it in the dashboard: **Paddle → Developer Tools → Authentication → API keys**. The full key is shown **once** at creation — if lost, revoke and regenerate.
- **Server-side only.** Never put an API key in the Expo/web bundle.

Example request:
```
curl -X POST https://sandbox-api.paddle.com/transactions \
  -H "Authorization: Bearer pdl_sdbx_apikey_…" \
  -H "Content-Type: application/json" \
  -d '{ "items": [ { "price_id": "pri_…", "quantity": 1 } ], "custom_data": { "app_user_id": "…" } }'
```

### Client-side (Paddle.js)

- **Client-side token** (`live_…` / `test_…`, format `^(test|live)_[a-zA-Z0-9]{27}$`). Limited to opening checkouts and previewing prices/transactions; **safe to publish** in frontend code. Get it under **Paddle → Developer Tools → Authentication → Client-side tokens**.
- **Sandbox/live switch in Paddle.js:** call `Paddle.Environment.set("sandbox")` **before** `Paddle.Initialize()`. `production` is the default; the docs recommend simply **removing** the `Environment.set` call (don't call it) for production builds.

```javascript
// include via CDN: <script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
// or npm: @paddle/paddle-js  ->  import { initializePaddle } from "@paddle/paddle-js";

Paddle.Environment.set("sandbox");        // omit/remove in production
Paddle.Initialize({
  token: "test_7d279f61a3499fed520f7cd8c08"   // client-side token (test_ in sandbox)
});
```

> **Never use an API key with Paddle.js**, and never use a client-side token for REST calls — they are different credential types.

Sources: [Authentication](https://developer.paddle.com/api-reference/about/authentication/), [Manage API keys](https://developer.paddle.com/api-reference/about/api-keys), [Client-side tokens](https://developer.paddle.com/paddle-js/about/client-side-tokens), [Paddle.Environment.set()](https://developer.paddle.com/paddle-js/methods/paddle-environment-set/), [Include Paddle.js](https://developer.paddle.com/paddle-js/about/include-paddlejs)

---

## 6. Entitlement model (recommended pattern)

**Webhooks are authoritative. The checkout success/redirect is only an instant-unlock hint.**

1. **Grant/revoke from webhooks based on subscription status** (section 3):
   - `subscription.created` / `subscription.activated` → record `customer_id` + `subscription_id` against the app user (matched via `custom_data.app_user_id`), grant access.
   - `subscription.updated` → refresh cached `status`, `current_billing_period.ends_at`, `items[].price.id` (entitlement tier). One handler covers renewals, plan changes, pauses, resumes, and status flips.
   - `subscription.canceled` (or `paused`) → revoke / restrict.
   - `past_due` → keep access, surface a "update payment" banner (Paddle Retain handles dunning).
2. **Instant unlock on the client:** after checkout completes (success redirect or Paddle.js `checkout.completed` event), optimistically show "you're Pro" so the UX isn't gated on webhook latency. **Do not treat this as proof** — the server entitlement is set by the webhook.
3. **Reconcile / repair drift:** because delivery is at-least-once and webhooks can be missed, periodically (or on app focus / on the success redirect) call **`GET /subscriptions/{id}`** (Bearer API key) and re-sync status. The provisioning guide explicitly recommends periodic reconciliation against the API to repair drift. Cache fields server-side: `customer_id`, `subscription_id`, `status`, `current_billing_period.ends_at`, and the purchased `price.id`.
4. **Idempotency:** dedupe webhook processing on `event_id`; order by `occurred_at`, not arrival time.

**Suggested entitlement state to persist per user:** `paddle_customer_id`, `paddle_subscription_id`, `subscription_status`, `current_period_ends_at`, `plan_price_id`, `updated_from_event_id`.

Sources: [Provision access and handle subscription state](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/), [Get a subscription](https://developer.paddle.com/api-reference/subscriptions/get-subscription), [How webhooks work](https://developer.paddle.com/webhooks/about/how-webhooks-work/)

---

## 7. Human setup checklist (sandbox → live)

### Sandbox setup (founder, in the dashboard)

1. **Create a sandbox account** at `https://sandbox-vendors.paddle.com/signup`. Sandbox is a **fully separate** dashboard/dataset/credentials from live (`vendors.paddle.com`). Sandbox checkouts show a "Test Mode" watermark; any domain works without verification.
2. **Set a Default payment link:** Paddle → Checkout → Checkout settings → Default payment link. (Required before any checkout/transaction works. In sandbox this can be any URL, e.g. your Vercel preview domain.)
3. **Create the catalog:** one **Product** (e.g. "T Poker Pro") + two **Prices** — monthly and yearly — each with its `billing_cycle`. Note the `pri_…` IDs.
4. **Get the client-side token:** Developer Tools → Authentication → Client-side tokens (`test_…`). For the frontend.
5. **Get the API key:** Developer Tools → Authentication → API keys (`pdl_sdbx_apikey_…`). For the backend. Copy it now — shown once.
6. **Create a webhook destination (notification setting):** Developer Tools → Notifications → add a destination pointing at your backend webhook URL; subscribe to `subscription.created`, `subscription.updated`, `subscription.canceled`, `subscription.activated`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`, `transaction.completed`. Copy its **signing secret** (`pdl_ntfset_…`).
7. **Test cards (sandbox only):** `4242 4242 4242 4242` (no 3DS), `4000 0038 0000 0446` (3DS), `4000 0000 0000 0002` (declined).

### Env vars implied

**Backend (.NET):**
- `Paddle__ApiBaseUrl` = `https://sandbox-api.paddle.com` (→ `https://api.paddle.com` for live)
- `Paddle__ApiKey` = `pdl_sdbx_apikey_…`
- `Paddle__WebhookSigningSecret` = `pdl_ntfset_…`
- (app config) the monthly/yearly `pri_…` IDs

**Frontend (Expo / `EXPO_PUBLIC_*`):**
- `EXPO_PUBLIC_PADDLE_CLIENT_TOKEN` = `test_…` (→ `live_…` for live)
- `EXPO_PUBLIC_PADDLE_ENVIRONMENT` = `sandbox` (→ omit/`production` for live)
- the monthly/yearly `pri_…` IDs (or fetch from backend)

### Test → live switch

Sandbox and live share zero data — **everything is recreated in live**:

1. Create/verify the **live** account; pass **website/domain verification** (live default payment link must be a real, verified domain — not `localhost`).
2. **Recreate the catalog** in live → brand-new `pro_…` / `pri_…` IDs. Swap every price ID in code/config.
3. Generate a **live API key** (`pdl_live_apikey_…`) and a **live client-side token** (`live_…`); swap both.
4. **Recreate the webhook destination** in live → new **signing secret** (`pdl_ntfset_…`); swap it.
5. Frontend: **remove `Paddle.Environment.set("sandbox")`** (default is production).
6. Backend: change base URL `sandbox-api.paddle.com` → `api.paddle.com`.
7. (Optional but recommended) allowlist Paddle's live webhook source IPs.

> **Verified-domains requirement for Paddle.js:** on live, the checkout's default payment link domain must be **approved/domain-verified**. Plan for our production domain (`poker-home-games-three.vercel.app`, or a custom domain) to be the approved checkout host.

Sources: [Sandbox](https://developer.paddle.com/build/tools/sandbox), [Go-live checklist](https://developer.paddle.com/build/onboarding/go-live-checklist), [Authentication](https://developer.paddle.com/api-reference/about/authentication/), [Client-side tokens](https://developer.paddle.com/paddle-js/about/client-side-tokens)

---

## ⚠ VERIFY AGAINST SANDBOX

Items below are believed correct from the docs but should be confirmed against a real sandbox event/response before they're load-bearing in code.

1. **Full webhook envelope nesting** — The composed `subscription.created` skeleton (section 3) is assembled from the documented envelope spec + a real GET-subscription `data` body. Confirm the exact top-level field set and that `data` is the unwrapped entity (no extra wrapper) by capturing a real sandbox webhook. Specifically confirm `transaction_id` is present at `data.transaction_id` on `subscription.created`.
2. **Webhook signing-secret prefix `pdl_ntfset_…`** — Confirmed on the signature-verification page; double-check the exact prefix on your created destination (Paddle has changed credential formats over time).
3. **Replay tolerance = 5 seconds** — That's the SDK default per the docs. A strict 5s window can reject legitimate events under clock skew/processing delay. Confirm Paddle's current recommended max variance and decide your tolerance (consider 5–60s, and ensure server clock is NTP-synced).
4. **Raw-body access in ASP.NET Core** — The signature must be computed over the exact raw bytes. Verify your pipeline (controller vs minimal API + `EnableBuffering`/`PipeReader`) actually hands you the unmodified body. A `[FromBody]`-bound model will NOT work for verification.
5. **No official .NET/C# Paddle SDK** — Paddle ships SDKs for Node, Go, PHP, Python. Confirm there is still no maintained first-party C# SDK; if true, REST calls + manual signature verification must be hand-rolled (HMACSHA256 + FixedTimeEquals as described).
6. **`Create transaction` response `checkout.url` auto-population** — Confirm that a `collection_mode: "automatic"` transaction returns a usable `checkout.url` with `?_ptxn=` **without** extra `billing_details` config, and capture the exact response JSON (the create-transaction doc page didn't include a full example).
7. **API key format `pdl_<env>_apikey_…` (69 chars, 5 underscores)** — This is the 2025 "enhanced API keys" format. Confirm new sandbox keys match this (older material sometimes shows bare `…` keys). The **client-side token** format `^(test|live)_[a-zA-Z0-9]{27}$` should also be confirmed.
8. **Item-level `custom_data` location** — Docs were inconsistent about whether per-item `custom_data` sits under `items[].price` vs `items[].product`. This does NOT affect us (we read **subscription-root** `data.custom_data`), but don't rely on item-level custom data without checking.
9. **`pwCustomer` in `Paddle.Initialize`** — The go-live notes mention passing `pwCustomer` (customer id/email) to enable Paddle **Retain**. Treat as optional/Retain-specific and verify whether it's needed for our basic subscription flow (likely not required just to open a checkout).
10. **`transaction.paid` vs `transaction.completed` timing** — We plan to provision on `transaction.completed` (subscription guaranteed to exist). Confirm on sandbox that `subscription.created` and `transaction.completed` both arrive and that `transaction.completed.data.subscription_id` is populated for the recurring purchase.
11. **Transaction status enum** — Only `created`/`paid`/`completed` were verified via events. If you branch on transaction status elsewhere, confirm the full enum (likely also `draft`, `ready`, `billed`, `canceled`, `past_due`).
12. **Israel as MoR seller country** — Paddle as Merchant of Record is the reason we chose it (handles tax, supports IL-based sellers). Confirm current Paddle seller-country eligibility/onboarding for Israel during live account verification.

---

## Sources (all URLs fetched)

- https://developer.paddle.com/paddle-js/methods/paddle-checkout-open/
- https://developer.paddle.com/build/checkout/build-overlay-checkout
- https://developer.paddle.com/build/transactions/pass-transaction-checkout/
- https://developer.paddle.com/api-reference/transactions/create-transaction
- https://developer.paddle.com/api-reference/about/custom-data
- https://developer.paddle.com/build/transactions/custom-data
- https://developer.paddle.com/webhooks/about/how-webhooks-work/
- https://developer.paddle.com/webhooks/overview
- https://developer.paddle.com/webhooks/about/signature-verification/
- https://developer.paddle.com/webhooks/subscriptions/subscription-created/
- https://developer.paddle.com/webhooks/subscriptions/subscription-updated/
- https://developer.paddle.com/webhooks/subscriptions/subscription-canceled/
- https://developer.paddle.com/webhooks/transactions/transaction-completed/
- https://developer.paddle.com/build/subscriptions/provision-access-webhooks/
- https://developer.paddle.com/api-reference/subscriptions/get-subscription
- https://developer.paddle.com/api-reference/about/authentication/
- https://developer.paddle.com/api-reference/about/api-keys
- https://developer.paddle.com/paddle-js/about/client-side-tokens
- https://developer.paddle.com/paddle-js/methods/paddle-environment-set/
- https://developer.paddle.com/paddle-js/about/include-paddlejs
- https://developer.paddle.com/build/tools/sandbox
- https://developer.paddle.com/build/onboarding/go-live-checklist
