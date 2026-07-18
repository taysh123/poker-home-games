# T Poker — Go-Live Runbook (real money + AI Coach)

> **Read this first.** This is the single, follow-it-step-by-step guide for turning on the two things
> that cost (or earn) real money: **paid subscriptions via Paddle** and the **AI Coach** (which spends
> Anthropic API credits). It is written to be followed by a non-expert. Every dashboard click, every
> environment variable name, and exactly where each one goes is spelled out.
>
> **Nothing in this document has been executed.** These are manual steps *you* perform when you decide
> to launch. The code is already built, tested, and shipped behind OFF-by-default flags — so production
> stays byte-for-byte identical until you deliberately flip a switch here.
>
> **Companion docs (deeper detail, already written):**
> - `docs/release/paddle-setup.md` — the full Paddle *sandbox* setup + the 22-item "PADDLE-VERIFY" table.
> - `docs/release/paddle-billing-research.md` — the underlying Paddle Billing research.
> - `docs/release/rollback-recovery.md` — emergency rollback.
> - `docs/release/backlog-tickets.md` — deferred hardening (incl. the Cloud Sync concurrency ticket).

---

## The golden rule (the safety model)

Everything below is **fail-closed**. If a key is missing, the feature silently stays OFF and the app
behaves exactly as it does today. Concretely:

| Feature | Stays OFF until… | Where it's gated |
|---------|------------------|------------------|
| Paddle checkout | `Paddle__ApiKey` **and** both `Paddle__Price*Id` are set | `PaddleSettings.IsConfigured` |
| Webhook grants | `Paddle__WebhookSigningSecret` is set **and** `BillingSettings__Provider=direct` | `PaddleSettings.WebhookConfigured`, `DirectBillingVerifier` |
| The paywall UI | the `paywall` flag is flipped ON in code | `apps/poker-mobile/src/config/features.ts` |
| AI Coach (real) | `CoachAiSettings__Provider=anthropic` **and** `CoachAiSettings__ApiKey` set | `CoachAiProviderFactory` |
| AI Coach UI | the `coach` flag is flipped ON in code | `apps/poker-mobile/src/config/features.ts` |

A missing or empty secret never charges a card and never calls Anthropic. You cannot "half-launch" by
accident — the active provider only switches when *all* of its required values are present.

**Order matters:** do **Paddle in sandbox** (Part 1–3) and prove a real signed webhook verifies
(Part 2) **before** you ever touch live keys (Part 4–5). Do the AI Coach (Part 6) independently — it
has nothing to do with Paddle and can be turned on at a different time.

---

## What you'll need before you start

- Admin access to the **Railway** project (the backend) — this is where server **secrets** live.
- Admin access to the **Vercel** project (the web app) — this is where the **public** client values live.
- The ability to **edit + commit** `apps/poker-mobile/src/config/features.ts` and redeploy (flag flips are
  code changes, not env vars — see the note in Part 1, Step 6).
- A **Paddle sandbox** account (free) for Part 1–3; a **verified Paddle live** account for Part 4–5.
- An **Anthropic API key** for Part 6 (only if/when you turn on the AI Coach).

> **Secrets never go in code, screenshots, or chat.** API keys and signing secrets are entered *only* in
> the Railway dashboard. The Paddle *client-side token* is public (safe in the web bundle) but still set
> via env, never committed.

---

# PART 1 — Paddle in SANDBOX (rehearsal with fake money)

Sandbox is a completely separate Paddle account from live; credentials do **not** carry over. This part
mirrors `paddle-setup.md` §1–§2 — follow that doc for screenshots; the condensed path is here so this
runbook is self-contained.

### Step 1 — Create the sandbox account + default payment link
1. Sign up at **`https://sandbox-vendors.paddle.com/signup`**.
2. **Catalog → Checkout settings → Payment links → Add payment link.** Enter
   `https://poker-home-games-three.vercel.app` and mark it **Default**. (Paddle refuses to open any
   checkout until a default payment link exists.)

### Step 2 — Create the product + two prices
1. **Catalog → Products → Create product** → Name **T Poker Premium**, type Software/SaaS, tax category Standard.
2. Add **two prices** inside that product:

   | Price name | Billing cycle | Amount (USD) |
   |------------|---------------|--------------|
   | T Poker Premium Monthly | Monthly | **8.99** |
   | T Poker Premium Yearly  | Yearly  | **79.99** |

   > These must match the app's displayed prices (`$8.99/mo`, `$79.99/yr` in
   > `apps/poker-mobile/src/features/premium/config.ts`). If you change them, change both places.
3. Open each saved price and copy its **`pri_…` id**. You now have a monthly `pri_…` and a yearly `pri_…`.

### Step 3 — Generate the three Paddle credentials
In **Developer Tools → Authentication**:
1. **Client-side tokens → Generate** → copy the **`test_…`** value. *(Public — this is the only Paddle value that goes to Vercel.)*
2. **API keys → Generate** → copy the **`pdl_sdbx_apikey_…`** value (shown **once**). *(Secret — Railway only.)*

In **Developer Tools → Notifications → New destination**:
3. URL = **`https://<your-railway-domain>/api/webhooks/paddle`** (your deployed backend's Railway URL).
4. Subscribe to: `subscription.created`, `subscription.activated`, `subscription.updated`,
   `subscription.canceled`, `subscription.past_due`, `transaction.completed`.
5. Copy the destination's **signing secret `pdl_ntfset_…`** (shown **once**). *(Secret — Railway only.)*

### Step 4 — Set the backend (Railway) variables
Railway → your backend service → **Variables** → add these (Railway uses `__` to nest config keys):

```
Paddle__ApiBaseUrl=https://sandbox-api.paddle.com
Paddle__ApiKey=<pdl_sdbx_apikey_…>
Paddle__WebhookSigningSecret=<pdl_ntfset_…>
Paddle__PriceMonthlyId=<monthly pri_…>
Paddle__PriceYearlyId=<yearly pri_…>
BillingSettings__Provider=direct
BillingSettings__AcceptSandbox=true
```

- `BillingSettings__Provider=direct` switches the webhook verifier from the dev **mock** to the real
  **DirectBillingVerifier** (which dispatches to the Paddle verifier). Without it, a real webhook is
  ignored.
- `BillingSettings__AcceptSandbox=true` lets *sandbox* subscriptions grant entitlements. **This MUST be
  flipped to `false` for live** (Part 4) so a sandbox transaction can never grant production premium.

Railway redeploys automatically when you save variables. Wait for the deploy to go green.

### Step 5 — Set the frontend (Vercel) variables
Vercel → your project → **Settings → Environment Variables** → add (these are **public**, `EXPO_PUBLIC_`):

```
EXPO_PUBLIC_PADDLE_CLIENT_TOKEN=<test_…>
EXPO_PUBLIC_PADDLE_ENVIRONMENT=sandbox
EXPO_PUBLIC_PREMIUM_MONTHLY_ID=tpoker.premium.monthly
EXPO_PUBLIC_PREMIUM_YEARLY_ID=tpoker.premium.yearly
```

- `EXPO_PUBLIC_PADDLE_ENVIRONMENT=sandbox` makes the client call `Paddle.Environment.set('sandbox')`
  before initializing. (For live you **remove** this var — see Part 4.)
- `EXPO_PUBLIC_PREMIUM_MONTHLY_ID` / `_YEARLY_ID` are the app's *internal* plan identifiers used to route
  the click to the right plan. They do **not** need to equal the Paddle `pri_…` ids (the server maps
  plan → `pri_…` from `Paddle__Price*Id`). The defaults above are fine; you only override them if you
  want different internal product ids. Redeploy Vercel after saving.

### Step 6 — Flip the `paywall` flag ON (code change + redeploy)
The paywall UI is gated by a flag in code — there is **no env var** for it. Edit
`apps/poker-mobile/src/config/features.ts`, in `PROD_FLAGS`:

```ts
paywall: false,   →   paywall: true,
```

Commit and redeploy Vercel (and rebuild any native app). Until this is `true`, the paywall is invisible
and nothing can be purchased — which is exactly why it's safe to set the env vars first.

> **Why a code change and not an env var?** Production flags resolve from `PROD_FLAGS` only (beta/dev
> overrides don't apply to prod builds). Flipping a launch flag is a deliberate, reviewable commit. To
> turn the paywall back OFF instantly, revert this one line and redeploy (see Part 7).

---

# PART 2 — Prove the live-HMAC webhook verifies (the one critical check)

This is the single most important verification in the whole Paddle integration, and the only item
`paddle-setup.md` lists as **STILL PENDING**: confirming that a **real, signed** Paddle webhook delivery
is accepted by our endpoint (HTTP **200**) rather than rejected (HTTP **401**).

**How the check works under the hood** (so you know what "good" looks like):
- Paddle signs every webhook with the header `Paddle-Signature: ts=<unix>;h1=<hex>`.
- Our endpoint `POST /api/webhooks/paddle` reads the **raw body**, recomputes
  `HMAC-SHA256( key = pdl_ntfset_… , message = "<ts>:<rawBody>" )`, and compares it to `h1` in constant
  time, allowing a 300-second timestamp tolerance.
- **Match → 200 and the entitlement is granted. Any mismatch → 401 and nothing changes.** (Code:
  `src/PokerApp.Infrastructure/Billing/PaddleSignature.cs`, `WebhooksController.Paddle`.)

### Step 1 — Send a signed event
Two equivalent ways:
- **Simplest:** in the Paddle sandbox dashboard, open your **Notifications → destination → "Send test
  event"** (or simply complete the sandbox test purchase in Part 3 — a real `subscription.created` +
  `transaction.completed` will be delivered and signed identically).

### Step 2 — Confirm 200 + verified, in two places
1. **Railway logs** (your backend service → Logs): look for `POST /api/webhooks/paddle` returning **200**.
   A `401` means the signing secret on Railway doesn't match the destination's secret — re-copy
   `Paddle__WebhookSigningSecret` from **the exact destination** you're sending from.
2. **Paddle dashboard → Notifications → your destination → Logs:** the event shows **Delivered** with a
   `200` response.

### Step 3 — Confirm the grant landed
Sign in to the app as the purchasing test user and call (or watch the app call) **`GET /api/entitlements`**
— it should return `plan: "premium"`. That proves the whole chain: signed webhook → verified → DB
`Subscription` row → server-computed entitlement.

> **Where to run this branch.** Production `main` does **not** contain the billing code yet, so a webhook
> to the prod URL would `404`. Until this branch is merged + deployed, point the Paddle destination at a
> host actually running this branch — a Railway staging service on this branch, or a local backend
> exposed with `ngrok`. The exact two recipes are in `paddle-setup.md` §"Runtime E2E — how to resume
> later" (Option A: local + ngrok, recommended; Option B: Railway/Vercel staging). Revert the webhook URL
> afterwards.

---

# PART 3 — Test purchase in SANDBOX (no real money)

1. Open the web app at your Vercel domain (the build with `paywall` ON).
2. Open the paywall. Confirm the honesty presentation is correct:
   - **Premium Study** shows as a live benefit (gold icon, no "Soon" chip).
   - **AI Coach / Cloud sync / Advanced bankroll** show **"Soon"** chips and no per-feature buy CTA.
     *(They are `comingSoon: true` in `premium/config.ts` and must stay that way until each is genuinely
     live — never charge for a "Soon" benefit. See Part 6 for the AI Coach flip.)*
   - The annual plan is the default; CTA reads `Go Premium — $79.99/yr`.
3. Click buy. The **Paddle overlay** opens (dark theme). Pay with a sandbox test card:
   - `4242 4242 4242 4242` — succeeds, no 3-D Secure. Any future expiry, any CVC, any name.
   - `4000 0038 0000 0446` — forces a 3-D Secure challenge (test the SCA path).
   - `4000 0000 0000 0002` — declines (test the failure path).
4. The overlay closes; the paywall shows a "completing" pending state. (The client returns
   `pending_verification` — the grant is server-side only.)
5. The webhook from Part 2 grants premium. Tap **"I've completed payment — activate"** (the instant-unlock
   path calls `POST /api/billing/verify-session`), or just reopen the app — `GET /api/entitlements`
   returns `premium`.
6. Confirm premium features are now reachable without an upgrade prompt.

When sandbox purchase + webhook + grant all work, you are ready for live.

---

# PART 4 — Switch SANDBOX → LIVE (real money)

Everything must be **recreated** in the live account — IDs, keys, and secrets are not shared with sandbox.

### Step 1 — Live Paddle account
1. Create a live account at **`https://vendors.paddle.com`**, complete **business verification**, add a
   **bank account**, and **verify the payment-link domain** (Paddle requires domain verification for live).
   *(Note: confirm Paddle seller eligibility for your country during verification.)*

### Step 2 — Recreate catalog + credentials (live)
2. Recreate the **product + two prices** ($8.99 monthly, $79.99 yearly) → note the new **live `pri_…`** ids.
3. Generate a **live API key** `pdl_live_apikey_…`. *(Secret.)*
4. Generate a **live client-side token** `live_…`. *(Public.)*
5. Create a **live webhook destination** at `https://<your-railway-domain>/api/webhooks/paddle` with the
   same six events → copy its **live signing secret `pdl_ntfset_…`**. *(Secret.)*

### Step 3 — Update Railway (backend) for live
Change these variables (note the two **fail-closed separation** flips at the bottom):

```
Paddle__ApiBaseUrl=https://api.paddle.com
Paddle__ApiKey=<pdl_live_apikey_…>
Paddle__WebhookSigningSecret=<live pdl_ntfset_…>
Paddle__PriceMonthlyId=<live monthly pri_…>
Paddle__PriceYearlyId=<live yearly pri_…>
BillingSettings__Provider=direct
BillingSettings__AcceptSandbox=false      ← MUST be false in production
```

`AcceptSandbox=false` is what guarantees a stray sandbox transaction can never grant a real entitlement.
Double-check it. Save → Railway redeploys.

### Step 3b — Confirm the reverse-proxy / rate-limiting config (security-hardening branch) ⚠️ DO NOT SKIP
The `security-hardening` branch (PR #11) adds **per-IP rate limiting** that reads the real client IP from
Railway's `X-Forwarded-For` header via `app.UseForwardedHeaders`. This needs **NO new variable** — but it
depends on one existing variable being exactly right, and a wrong value **locks users out**.

**DO THIS:** In Railway → your backend service → **Variables**, confirm this exact key/value is present:

```
ASPNETCORE_ENVIRONMENT=Production
```

That is the setting that enables the forwarded-headers de-proxy block (it runs only when the environment is
**not** Development). It is already a required variable — just confirm it and do not change it.

| Variable | Correct value on Railway | Why it matters |
|----------|--------------------------|----------------|
| `ASPNETCORE_ENVIRONMENT` | **`Production`** (exact) | Enables `UseForwardedHeaders`, so per-IP rate limits use the **real** client IP. |
| *(any forwarded-headers / proxy-hop var)* | **— set NOTHING —** | The proxy hop count is `ForwardLimit = 1` **in code** (one hop = Railway's edge). Do **NOT** add a `ForwardedHeaders__*` variable and do **NOT** set `KnownProxies` — either would break it. |

**If `ASPNETCORE_ENVIRONMENT` is missing or set to `Development`:** the de-proxy block is skipped → the server
reads **Railway's proxy IP** as *every* caller's IP → all users share **one** rate-limit bucket → legitimate
users get **429 on login/refresh under load = accidental lockout.** *Symptom:* everyone is throttled together
and Railway logs show a single client IP for all requests. *Fix:* set `ASPNETCORE_ENVIRONMENT=Production`, redeploy.

**Verify after deploy:** send >10 `POST /api/auth/login` in a minute from one machine → you get **429**; from a
**second** machine on a different network/IP, login **still works**. If the second machine is *also* throttled,
forwarded headers aren't applying — re-check `ASPNETCORE_ENVIRONMENT`.

**Security note:** this trusts Railway's single edge proxy to set `X-Forwarded-For`; do **not** run this backend
internet-exposed without a trusted proxy (a client could spoof the header). Full detail:
`docs/release/security-hardening-deploy.md`.

### Step 4 — Update Vercel (frontend) for live
```
EXPO_PUBLIC_PADDLE_CLIENT_TOKEN=<live_…>
EXPO_PUBLIC_PADDLE_ENVIRONMENT      ← DELETE this variable entirely
EXPO_PUBLIC_PREMIUM_MONTHLY_ID=tpoker.premium.monthly   (unchanged unless you customized it)
EXPO_PUBLIC_PREMIUM_YEARLY_ID=tpoker.premium.yearly     (unchanged unless you customized it)
```

**Removing** `EXPO_PUBLIC_PADDLE_ENVIRONMENT` is required: the client only calls
`Paddle.Environment.set('sandbox')` when that var equals `sandbox`. With it gone, Paddle.js initializes in
**production** mode. Redeploy Vercel. Re-point the live webhook destination at the prod backend URL.

---

# PART 5 — Live smoke test + refund procedure

Do **one** real, low-risk transaction end-to-end, then refund it.

### Test purchase (real card, real money — small + refundable)
1. On the live web app, open the paywall and buy the **monthly** plan ($8.99) with a **real card** (your own).
2. Confirm, exactly as in sandbox: Paddle overlay completes → Railway logs `POST /api/webhooks/paddle`
   → **200** → `GET /api/entitlements` returns `premium`.
3. In **Paddle (live) → Transactions**, confirm the transaction shows **Completed** and a subscription was created.

### Refund procedure (and confirm the downgrade)
4. In **Paddle → Transactions →** the transaction **→ Refund** (full). Approve it.
5. Paddle sends `subscription.canceled` (and/or `subscription.updated` with status canceled). Confirm:
   - Railway logs another `POST /api/webhooks/paddle` → **200**.
   - `GET /api/entitlements` for that user now returns `plan: "free"` — the entitlement was **revoked**.

   *(Verified in sandbox already: an immediate cancel fires both `subscription.canceled` and
   `subscription.updated(canceled)`, and both revoke — see `paddle-setup.md` §"Verification status".)*

If the purchase grants and the refund revokes, **Paddle is live and correct.** You can leave the paywall
ON.

---

# PART 6 — Activate the AI Coach (spends Anthropic credits)

Completely independent of Paddle. The Coach is already built with production-grade safety (server-
authoritative credit reservation, a hard monthly cap, idempotency, rate limiting, fraud signals, and a
fail-closed mock default). Turning it on is: **set a server key, pick the cheap model, flip one flag.**

### Step 1 — Set the backend (Railway) variables
```
CoachAiSettings__Provider=anthropic
CoachAiSettings__ApiKey=<your Anthropic key, sk-ant-…>
CoachAiSettings__Model=claude-haiku-4-5-20251001
CoachAiSettings__ApiBase=https://api.anthropic.com      (optional — this is already the default)
```

> **⚠ Set the model explicitly — this protects your costs.** The shipped default model is
> **`claude-sonnet-4-6`** (`appsettings.json` and `AnthropicCoachAiProvider.DefaultModel`). The whole
> "100 analyses/month ≈ \$0.60 cost vs \$8.99 revenue" economics assume the **Haiku** model (~\$0.006 per
> analysis). If you leave the default Sonnet model, each analysis costs **multiples** of that. Always set
> `CoachAiSettings__Model` to the current Haiku model id (`claude-haiku-4-5-20251001`) for launch
> economics. Only move to a larger model deliberately, knowing the per-analysis cost.

The key lives **only** on the server. It is never sent to the client. If the key is missing while
`Provider=anthropic`, the adapter throws and the reserved credit is **refunded** — it never fabricates a
result and never silently bills.

### Step 2 — Flip the `coach` flag ON (code change + redeploy)
In `apps/poker-mobile/src/config/features.ts`, in `PROD_FLAGS`:

```ts
coach: false,   →   coach: true,
```

Commit + redeploy. (Same mechanism and rationale as the `paywall` flag in Part 1, Step 6.)

### Step 3 — Verify the 100/month hard cap actually holds
The cap is **server-enforced** and on by **default** — you do not set it, and you should **not** override
it. The defaults live in `AiCreditSettings` (`Infrastructure/Identity/AiCreditSettings.cs`):

| Tier | Kind | Credits | Min interval |
|------|------|---------|--------------|
| Free | lifetime | **1** | 4 s |
| Premium | monthly | **100** | 2 s |

To verify the cap is genuinely in force:
1. **Confirm no override exists.** Make sure you have **not** set any `AiCreditSettings__Premium__Credits`
   variable on Railway. If absent, the built-in `100` applies. (Setting it to a huge number would defeat
   the cap — don't.)
2. **Confirm the server reserves before it spends.** Each analysis goes through
   `POST /api/coach/analyze`, which reserves a credit via `CreditLedger.TryConsumeAsync` **before** any
   Anthropic call. `GET /api/coach/credits` shows the remaining balance.
3. **Functional check (optional but reassuring):** as a premium test user, watch `GET /api/coach/credits`
   count down with each analysis. The **101st** analysis in a calendar month is rejected (quota
   exhausted) **before** any Anthropic request is made — so the cost ceiling is structural, not advisory.
   This behavior is pinned by the backend test suites `B2EnforcementTests`, `S6aMoneySafetyTests`, and
   `B5HardeningTests` (`dotnet test`).
4. **Free users get exactly 1 lifetime analysis**, and **guests get 0** (enforced separately) — so the
   Coach can never be farmed for free at scale.

> Cloud sync and Advanced bankroll analytics remain **"Soon"** (`comingSoon: true`) and are **not**
> activated by this runbook. They are built but intentionally not yet sold. Flipping them to live is a
> separate, deliberate change to `premium/config.ts` (guarded by `honesty.test.ts`) — do that only when
> you've decided to ship and support them.

---

# PART 7 — Emergency OFF (instant rollback)

If anything looks wrong after a flip, you can fully disable each feature without a database change:

| To turn OFF | Do this | Effect |
|-------------|---------|--------|
| The paywall | revert `paywall: true → false` in `features.ts`, redeploy | UI hidden; no new purchases possible |
| Paddle charging entirely | clear `Paddle__ApiKey` (or `Paddle__PriceMonthlyId`/`PriceYearlyId`) on Railway | `IsConfigured` → false → checkout provider falls back, fail-closed |
| Webhook grants | set `BillingSettings__Provider=mock` on Railway | real webhooks no longer grant |
| The AI Coach UI | revert `coach: true → false` in `features.ts`, redeploy | Coach hidden |
| AI Coach spend | set `CoachAiSettings__Provider=mock` (or clear `CoachAiSettings__ApiKey`) on Railway | no Anthropic calls; deterministic mock |

Existing entitlements already granted are unaffected by flag flips (they live in the DB). For a full code
rollback, see `docs/release/rollback-recovery.md`.

---

## Appendix — complete environment variable reference

**Backend → Railway** (secrets live here; `__` separates nested config keys):

| Variable | Sandbox value | Live value | Secret? |
|----------|---------------|-----------|---------|
| `ASPNETCORE_ENVIRONMENT` | `Production` | `Production` | no — but **required**; gates `UseForwardedHeaders` / per-IP rate limiting (see Part 4 Step 3b). No forwarded-headers/proxy var exists — hop count is `ForwardLimit=1` in code. |
| `Paddle__ApiBaseUrl` | `https://sandbox-api.paddle.com` | `https://api.paddle.com` | no |
| `Paddle__ApiKey` | `pdl_sdbx_apikey_…` | `pdl_live_apikey_…` | **yes** |
| `Paddle__WebhookSigningSecret` | `pdl_ntfset_…` (sandbox dest) | `pdl_ntfset_…` (live dest) | **yes** |
| `Paddle__PriceMonthlyId` | sandbox monthly `pri_…` | live monthly `pri_…` | no |
| `Paddle__PriceYearlyId` | sandbox yearly `pri_…` | live yearly `pri_…` | no |
| `BillingSettings__Provider` | `direct` | `direct` | no |
| `BillingSettings__AcceptSandbox` | `true` | **`false`** | no |
| `CoachAiSettings__Provider` | `anthropic` (when enabling Coach) | `anthropic` | no |
| `CoachAiSettings__ApiKey` | `sk-ant-…` | `sk-ant-…` | **yes** |
| `CoachAiSettings__Model` | `claude-haiku-4-5-20251001` | `claude-haiku-4-5-20251001` | no |
| `CoachAiSettings__ApiBase` | `https://api.anthropic.com` (default) | same | no |

**Frontend → Vercel** (all public, `EXPO_PUBLIC_`):

| Variable | Sandbox value | Live value |
|----------|---------------|-----------|
| `EXPO_PUBLIC_PADDLE_CLIENT_TOKEN` | `test_…` | `live_…` |
| `EXPO_PUBLIC_PADDLE_ENVIRONMENT` | `sandbox` | *(delete the variable)* |
| `EXPO_PUBLIC_PREMIUM_MONTHLY_ID` | `tpoker.premium.monthly` | `tpoker.premium.monthly` |
| `EXPO_PUBLIC_PREMIUM_YEARLY_ID` | `tpoker.premium.yearly` | `tpoker.premium.yearly` |

**Code flags → `apps/poker-mobile/src/config/features.ts` (`PROD_FLAGS`)** — commit + redeploy:

| Flag | Launch value | Controls |
|------|--------------|----------|
| `paywall` | `true` to sell | the paywall + upgrade prompts |
| `coach` | `true` to enable | the AI Coach surface |

**Key API endpoints involved (for log-watching):**
`POST /api/billing/checkout` (open checkout) · `POST /api/billing/verify-session` (instant unlock) ·
`POST /api/webhooks/paddle` (source-of-truth grant; 200 verified / 401 rejected) · `GET /api/entitlements`
(server-computed plan) · `POST /api/coach/analyze` + `GET /api/coach/credits` (Coach, credit-metered).
