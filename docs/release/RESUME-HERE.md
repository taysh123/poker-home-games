# ▶️ RESUME HERE — T Poker launch status

> **Read this first when you come back.** Everything is built, verified, and safely parked. You are
> **one external approval away from launch.** Nothing is broken; production is stable and unchanged.
> Take your time — this doc has the whole picture and the exact steps.

**TL;DR:** All the code + docs are done and sitting in reviewed pull requests. The **only** thing blocking
launch is **Paddle account approval** (payment processor). When Paddle approves, follow **§4 — The launch
sequence** and reference `docs/release/go-live-runbook.md` for the detailed clicks. Until then, production
is safe: every new feature is behind an OFF switch.

---

## 📌 Security & Paddle status (updated 2026-07-02)

**1. Security hardening — ✅ DONE · 🧊 PR #11 open against `main`, FROZEN for launch (do NOT merge).**
The pre-store security audit (2026-07-02) is fully remediated on **`security-hardening`** (6 commits, **PR #11**, gitleaks-clean):
- **H2** Paddle verify-session bound to the caller · **H3** AI-idempotency content-binding · **H4** sandbox-entitlement
  exclusion · **L2/L7/L8** input validators.
- **Option 4 (auth pipeline) — done:** **H1 + M2** rate limiters now partitioned per-IP (auth) / per-user (coach)
  + `app.UseForwardedHeaders()` for Railway; **M1** social-login empty-hash guard → 401 (not a 500 / enumeration oracle).
- Verified: **dotnet build 0-err · dotnet test 181 · tsc 0 · jest 528** — all green.
- **Frozen:** **PR #11** (base `main`) is open + MERGEABLE but must NOT merge until launch — it rides with #4/#5/#6. Read the **Railway note** below before deploying.
- **Recommendations only (NOT changed):** **M3** refresh-token in web `localStorage`, **L1** Google `email_verified`,
  **L3** AddPlayer consent, **L4/L6** config, npm audit-fix (can break Expo). Full detail: memory `security-audit`.

**2. Landing page for Paddle — ✅ DONE, DEPLOYED & RESUBMITTED.**
Paddle **rejected** `poker-home-games-three.vercel.app` as "Gambling" (they reviewed the raw web app). Fixed: the
marketing landing (`apps/landing`) now makes the non-gambling / educational / 18+ framing unmistakable — trust
banner, meta description, footer disclaimer, 18+ FAQ, softened hero. **PR #10 merged to `main`**, **deployed at
https://tpoker-landing-xi.vercel.app**, and **resubmitted to Paddle** (review can take up to ~3 days). This replaces
§2's "approval simply pending": approval is now gated on Paddle re-reviewing the landing domain.

**⚠️ Railway config for the rate-limit fix (H1) — read before deploying `security-hardening` / PR #11.**
Full detail: **`docs/release/security-hardening-deploy.md`** (in PR #11). The short version:
- **You do NOT add any new env var.** There is no `ForwardedHeaders__*` / proxy / hop-count variable — the hop count
  is `ForwardLimit = 1` (one hop = Railway's edge), hardcoded in `Program.cs`. Do **not** set `KnownProxies`.
- **The one setting that must be correct is `ASPNETCORE_ENVIRONMENT=Production`** on Railway (**already set**). It
  gates the `UseForwardedHeaders` de-proxy block (which runs only when NOT Development). Don't remove or change it.
- **If it's wrong** (missing / `Development`): the de-proxy is skipped → the app sees Railway's proxy IP for *every*
  caller → all users share **one** rate-limit bucket → **accidental lockout under load** (legit users get 429 on
  login). *Symptom:* everyone throttled together; logs show one IP. *Fix:* confirm `ASPNETCORE_ENVIRONMENT=Production`.
- **Security:** trusts Railway's single edge; do **NOT** run this app internet-exposed without a trusted proxy (a
  client could spoof `X-Forwarded-For`). **Verify after deploy:** rapid logins from one IP get 429 while a second IP
  still logs in.

---

## 1. Where we are — everything is built and frozen

Four pull requests capture all the work. **Three are frozen (do NOT merge until launch); one is already merged.**

| PR | What it is | Base | Status |
|----|-----------|------|--------|
| **#4** | **Launch buildout** — full redesign + 4 premium features (all flag-gated OFF) | `main` | 🧊 **open, frozen** |
| **#5** | **Coach + Study quality** — hand-aware/format-aware AI Coach, grounded in our data; Study upgrades | `feature/launch-buildout` | 🧊 **open, frozen** |
| **#6** | **Lottie polish** — 6 animations wired (celebration/achievement/success/loading/empty/splash) | `feature/coach-study-quality` | 🧊 **open, frozen** |
| **#7** | **Docs/OAuth** — Google-login diagnosis + native store OAuth prep | `main` | ✅ **MERGED to main** |

- The 3 feature PRs are **stacked** and merge **in order → #4, then #5, then #6** at launch (GitHub retargets
  each as its base lands).
- **Safety posture (why production is stable right now):** every new surface ships behind an **OFF feature
  flag**, the **AI Coach uses the mock provider** (no real Anthropic calls), the **honesty flip is HELD** (nothing
  is advertised as available before it's real — store/benefit badges stay "Coming soon"), and **no real-money
  billing is wired**. Production behaves exactly as it did before this work. Merging the PRs later doesn't
  change that until you deliberately flip flags in the launch sequence.

## 2. The one blocker — Paddle approval

**Paddle (the payment processor / Merchant of Record) account approval is pending.** That's it. Nothing
else blocks launch.

- **Going live is technically impossible until Paddle approves** — there are **no live Paddle keys** until
  then (no live API key, client token, or webhook secret exist to configure). So there is nothing to rush;
  the whole paid path simply can't be turned on yet.
- Email/password + Google sign-in, guest mode, and all the free features work today independently of Paddle.

## 3. What you've already done (external prep) ✅

- ✅ **GitHub 2FA** enabled.
- ✅ **Google + Apple developer accounts** owned.
- ✅ **Anthropic API key** obtained + a **spend limit set** — key stored securely, **NOT in Railway yet**
  (you'll add it during AI-Coach activation in the launch sequence).
- ✅ **Google Login verified working on web** (`poker-home-games-three.vercel.app` → signs in to Home). The
  whole chain — app code, Google Console, backend — is confirmed. *(Expo Go can't do Google sign-in — that's
  an SDK-54 limitation, not a bug; see `google-oauth-fix.md`.)*

## 4. The exact launch sequence (when Paddle approves)

Follow **`docs/release/go-live-runbook.md`** for every dashboard click + exact env-var name. The **order**:

1. **Paddle approves** → in the Paddle dashboard, go **sandbox → live**: create the live product + 2 prices
   ($8.99/mo, $79.99/yr), the live API key, client token, and webhook signing secret. Set the `Paddle__*`
   vars on Railway + the `EXPO_PUBLIC_PADDLE_*` vars on Vercel.
2. **One real test purchase** (small, refundable) end-to-end → confirm the webhook verifies (HTTP 200) and
   the entitlement grants; then **refund** it and confirm it revokes. *(Proves live billing works.)*
3. **Honesty flip (S9, currently HELD)** → flip the "Coming soon" benefits to live **only once they're real
   and billing is wired**. This is the point where the paywall may present them.
4. **Merge the feature PRs → #4, then #5, then #6** to `main` — each with a **full secret-scan (gitleaks) +
   all gates green** (tsc · jest · expo export · dotnet build/test · landing build). *(Merging is your action.)*
5. **Deploy the landing site to its own Vercel project** (see `landing-deploy.md`).
6. **Activate the AI Coach** → put the **Anthropic key on Railway** (`CoachAiSettings__ApiKey`), set
   **`CoachAiSettings__Provider=anthropic`**, and **set the model to Haiku** (`claude-haiku-4-5-20251001`) —
   **NOT Sonnet.** ⚠️ The shipped default is Sonnet, which costs multiples more; the 100/month economics
   assume Haiku. Then flip the `coach` flag.
7. **Live.** 🎉

> Everything above is **documented, not executed** — `go-live-runbook.md` has the beginner-friendly detail
> (every Paddle action, every env var, the live-HMAC verification, and the test-purchase + refund procedure).

## 5. Still-pending external prep you can do meanwhile

None of these block launch, but they move it forward:

- **Chase Paddle** — the critical path; approval is the blocker.
- **Accountant consultation** — tax/business setup for taking payments.
- **Store submission prep** — accounts are owned; the remaining steps (listings, credentials, and the
  **native iOS/Android Google OAuth setup**) are documented. The native OAuth is a **required pre-store
  step** now: create iOS + Android OAuth clients for `com.tpoker.app`, set the env vars, and add the iOS
  reversed-client-ID URL scheme to `app.json` (a ready-to-apply snippet — **not yet applied**). See
  `google-oauth-fix.md` §4 and `store-release.md` (Steps 3 + 8).

## 6. Post-launch backlog (NOT blockers — deliberately deferred)

- **Hebrew / RTL localization** — English launches first; Hebrew is a post-launch update. ~5–8 weeks of
  engineering, **RTL-dominated**. Full blueprint in `localization-plan.md`.
- **"Single active session" / device-login management** — a new post-launch auth feature (warn or
  force-logout on a second device). Captured in `backlog-tickets.md`.
- **Cloud Sync `xmin` concurrency hardening** — low priority; it self-heals today. `backlog-tickets.md`.
- **Cloud Sync tombstone compaction** — only matters at scale. `backlog-tickets.md`.
- **Study content authoring** — grow the question pool + richer explanations against the standard in
  `study-content-spec.md` (a content/workbook task, not code).

## 7. Key pointers — where the important docs live

> "On main" = you can open it now. "In PR #N" = it lands on `main` when that PR merges at launch.

| Doc | Path | Where | What it's for |
|-----|------|-------|---------------|
| **Go-live runbook** | `docs/release/go-live-runbook.md` | in **PR #4** | The step-by-step for Paddle live + AI Coach activation (§4 detail) |
| **Google OAuth fix** | `docs/google-oauth-fix.md` | ✅ **on main** | Web-verified; the required native store OAuth setup |
| **Store release guide** | `docs/store-release.md` | ✅ **on main** | Full App Store + Play submission checklist |
| **Localization plan** | `docs/release/localization-plan.md` | in **PR #5** | Hebrew/RTL blueprint + effort estimate |
| **Backlog tickets** | `docs/release/backlog-tickets.md` | in **PR #4** | The deferred hardening/auth tickets |
| **Study content spec** | `docs/content/study-content-spec.md` | in **PR #5** | The standard for authoring quiz content |
| **Landing deploy** | `docs/release/landing-deploy.md` | in **PR #4** | Deploying the marketing site to Vercel |

---

**You can safely close VS Code.** Nothing is running, nothing is half-done, production is stable. When you're
back and Paddle has approved, start at **§4**. 👋
