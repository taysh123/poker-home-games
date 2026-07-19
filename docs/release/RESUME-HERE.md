# ▶️ RESUME HERE — T Poker launch status

> **Read this first when you come back.** _Last updated: 2026-07-19._
>
> ⚠️ **Strategy changed — this doc's Paddle-gated plan below (§1–§7) is SUPERSEDED and kept only for history.**
> Web payments are dead (Paddle rejects poker). We pivoted to a **free-first app-store launch**; app-store
> billing comes later behind the existing `IBillingVerifier` seam. Current design of record:
> [`docs/superpowers/specs/2026-07-18-free-first-split-design.md`](../superpowers/specs/2026-07-18-free-first-split-design.md).

## ✅ Where we actually are (2026-07-19)

- **All frozen PRs are MERGED to `main`** — #4 → #5 → #6 → #14 → #11 landed in order, then the free-first
  split (**PR #20**). Production (Railway API + Vercel web/landing) is deployed and healthy.
- **Free-first split is live in the build:** the home-game manager, groups, stats, a daily quiz, three starter
  lessons (LM-01/LM-05/LM-04), and **10 shared practice questions/day** (Spot + Decision trainer, resets at
  local midnight) are all free. Premium (full lesson library, unlimited practice, AI Coach, Cloud Sync, advanced
  bankroll) is **"Coming soon" and not purchasable** — a CI-pinned honesty config guarantees **zero** live/
  chargeable features. AI Coach makes **zero** API calls (coach flag off + mock provider + no Anthropic key).
- **Education-first framing** shipped: onboarding pillars lead Learn → Practice → Play → Track; store listing
  copy leads with the study pillar (`docs/store-release.md`).

## ⏭️ WHEN I COME BACK — do this next (store launch, no billing)

1. **Native store prep (no payments needed):** `eas login` on this machine, create the iOS/Android Google OAuth
   clients for `com.tpoker.app`, and apply the not-yet-applied iOS reversed-client-ID URL scheme to `app.json`
   (`docs/google-oauth-fix.md` §4; `docs/store-release.md` Steps 3 + 8).
2. **Store assets:** regenerate the store screenshots in **study-first order** (lead with Spot Trainer / Lessons /
   quiz). ⚠️ The `store-shots.js` harness referenced by `store-assets/README.md` is **not in the repo** — author a
   capture harness or run your local one before submission.
3. **Submit** per `docs/store-release.md` (category Lifestyle/Utilities + Education secondary; reviewer note frames
   it as a study + scorekeeping tool, not gambling).
4. **Later (post-launch):** wire real app-store billing behind `IBillingVerifier`; only then flip any `comingSoon`.

**Domain-migration follow-ups (§6 below) still apply** now that the stack has merged.

---

---

> 🕰️ **Everything from here down (§1–§7) is HISTORICAL** — the pre-merge, Paddle-gated plan. All five PRs have
> since merged and the Paddle path is abandoned. Kept for provenance; do not act on it. The current plan is the
> banner at the top of this file.

## 1. Where we are — all code built, frozen in PRs

**Five launch PRs are frozen (do NOT merge until launch). They merge in order → #4 → #5 → #6 → #14 → #11.**

| PR | What it is | Base | Status |
|----|-----------|------|--------|
| **#4** | **Launch buildout** — full redesign + 4 premium features (all flag-gated OFF) | `main` | 🧊 **open, FROZEN** |
| **#5** | **Coach + Study quality** — hand/format-aware AI Coach (mock/flags-off); Study upgrades | `feature/launch-buildout` | 🧊 **open, FROZEN** |
| **#6** | **Lottie polish** — 6 animations wired (celebration/achievement/success/loading/empty/splash) | `feature/coach-study-quality` | 🧊 **open, FROZEN** |
| **#14** | **Entry experience** — BrandSplash 2.0 (~1.2s, skippable, reduced-motion safe) + **Welcome chooser** (explicit "Continue as guest" / "Sign in" — no more silent guest; guest data zero-write pinned) + auth polish + navy web shell. Flags `v2Splash`/`welcome` ON-at-launch, each a kill-switch. Gates: tsc 0 · jest 620 · axe 0 · Playwright 10/10 vs real web export; adversarially reviewed (fixes landed) | `feature/lottie-polish` | 🧊 **open, FROZEN** |
| **#11** | **Security hardening** — all 7 audit fixes: **H2/H3/H4** billing + **H1/M2/M1** auth-pipeline + **L2/L7/L8** validators (TDD; dotnet 181 · jest 528 · tsc 0; gitleaks-clean) | `main` | 🧊 **open, FROZEN** |

**Already merged to `main`:** **#7** docs/OAuth · **#9** legal + pricing pages (Paddle policies) · **#10** landing
anti-gambling (deployed) · **#12** these RESUME/docs updates.

- **Merge order at launch: #4 → #5 → #6 → #14 → #11.** The feature stack retargets as each lands (#14 stacks on
  #6's branch); **#11** (security) is independent of the stack and merges last so its fixes deploy with everything.
  Each merge: gitleaks + all gates green.
- **Safety posture (why production is stable right now):** every new surface is behind an **OFF flag**, the **AI Coach
  uses the mock provider** (no Anthropic calls), the **honesty flip is HELD** (store/benefit badges stay "Coming
  soon"), and **no real-money billing is wired**. Production behaves exactly as before until you flip flags in §4.

## 2. The blocker — Paddle (re-reviewing the landing)

**Paddle first REJECTED `poker-home-games-three.vercel.app` as "Gambling"** (they reviewed the raw web app). Fixed:
the marketing **landing site** (`apps/landing`) now frames T Poker unmistakably as **home-game management + poker
study — NOT a gambling product, no real-money wagering, 18+** (trust banner, meta description, footer disclaimer,
18+ FAQ, softened hero). It is **deployed at `https://tpoker-landing-xi.vercel.app`** and **RESUBMITTED to Paddle**.

- **Status: under review — up to ~3 working days.** Nothing else blocks launch.
- Going live is technically impossible until Paddle approves (no live Paddle keys exist yet). Email/password +
  Google sign-in, guest mode, and all free features work today, independently of Paddle.

## 3. What you've already done (external prep) ✅

- ✅ **GitHub 2FA** enabled.
- ✅ **Google + Apple developer accounts** owned.
- ✅ **Anthropic API key** obtained + a **spend limit set** — stored securely, **NOT in Railway yet** (you add it
  during AI-Coach activation in the launch sequence).
- ✅ **Google Login verified working on web** (`poker-home-games-three.vercel.app` → signs in to Home). The whole
  chain — app code, Google Console, backend — is confirmed. *(Expo Go can't do Google sign-in — SDK-54 limitation,
  not a bug; see `google-oauth-fix.md`.)*

## 4. The exact launch sequence (when Paddle approves)

Follow **`docs/release/go-live-runbook.md`** for every dashboard click + exact env-var name. The **order**:

1. **Paddle approves** → in the Paddle dashboard, go **sandbox → live**: create the live product + 2 prices
   ($8.99/mo, $79.99/yr), the live API key, client token, and webhook signing secret. Set the `Paddle__*` vars on
   Railway + the `EXPO_PUBLIC_PADDLE_*` vars on Vercel.
2. **One real test purchase** (small, refundable) end-to-end → confirm the webhook verifies (HTTP 200) and the
   entitlement grants; then **refund** it and confirm it revokes. *(Proves live billing works.)*
3. **Honesty flip (HELD)** → flip the "Coming soon" benefits to live **only once they're real and billing is wired**.
4. **Merge the PRs → #4 → #5 → #6 → #14 → #11** to `main` — each with a **full gitleaks scan + all gates green**
   (tsc · jest · expo export · dotnet build/test · landing build). *(Merging is your action.)*
5. **Deploy + set the Railway rate-limit config.** Railway auto-deploys `main`. ⚠️ **Confirm
   `ASPNETCORE_ENVIRONMENT=Production` is set on Railway** — it is the **one** setting that enables
   `app.UseForwardedHeaders`, so the new **per-IP rate limiting** (from PR #11) reads the **real** client IP.
   **Add NO forwarded-headers/proxy variable** — the proxy hop count is `ForwardLimit = 1` **in code** (one hop =
   Railway's edge); do **not** set `KnownProxies`. **If `ASPNETCORE_ENVIRONMENT` is missing/`Development`:** the
   app sees Railway's proxy IP for everyone → all users share **one** rate-limit bucket → **login lockout under
   load.** Detail: runbook **Part 4 Step 3b** + **`docs/release/security-hardening-deploy.md`**. *(The landing is
   already deployed at `tpoker-landing-xi.vercel.app` — no separate landing deploy is needed at launch.)*
6. **Activate the AI Coach** → put the **Anthropic key on Railway** (`CoachAiSettings__ApiKey`), set
   **`CoachAiSettings__Provider=anthropic`**, and **set the model to Haiku** (`claude-haiku-4-5-20251001`) —
   **NOT Sonnet.** ⚠️ The shipped default is Sonnet, which costs multiples more; the 100/month economics assume
   Haiku. Then flip the `coach` flag.
7. **Live.** 🎉

> Everything above is **documented, not executed** — `go-live-runbook.md` has the beginner-friendly detail (every
> Paddle action, every env var, the live-HMAC verification, the test-purchase + refund procedure, and the Railway
> forwarded-headers step).

## 5. Still-pending external prep you can do meanwhile

None of these block launch, but they move it forward:

- **Chase Paddle** — the critical path; the landing re-review is the blocker.
- **Accountant consultation** — tax/business setup for taking payments.
- **Store submission prep** — accounts are owned; the remaining steps (listings, credentials, and the **native
  iOS/Android Google OAuth setup**) are documented. The native OAuth is a **required pre-store step**: create iOS +
  Android OAuth clients for `com.tpoker.app`, set the env vars, and add the iOS reversed-client-ID URL scheme to
  `app.json` (a ready-to-apply snippet — **not yet applied**). See `google-oauth-fix.md` §4 and `store-release.md`
  (Steps 3 + 8).

## 6. Post-launch backlog (NOT blockers — deliberately deferred)

- **Hebrew / RTL localization** — English launches first; Hebrew is a post-launch update. ~5–8 weeks, RTL-dominated.
  Full blueprint in `localization-plan.md`.
- **"Single active session" / device-login management** — post-launch auth feature. `backlog-tickets.md`.
- **Cloud Sync `xmin` concurrency hardening** — low priority; self-heals today. `backlog-tickets.md`.
- **Cloud Sync tombstone compaction** — only matters at scale. `backlog-tickets.md`.
- **Study content authoring** — grow the question pool + richer explanations (`study-content-spec.md`).
- **Repo hygiene** — remove committed build output `src/PokerApp.API/out2/` and gitignore `out*/`
  (one-line PR; found during the 2026-07-07 CI/case-sensitivity scan — harmless, just clutter).
- **Domain-migration follow-ups (tpoker.app, deferred 2026-07-16 — do RIGHT AFTER the stack merges;
  all four values live in frozen-PR-owned files and currently work via the old domain's 307 redirects):**
  1. `AppNavigator.tsx` linking `prefixes`: add `https://app.tpoker.app` (keep the old vercel domain
     for already-shared invite links). Native-only concern — web invite routing is path-based.
  2. `app.json` android `intentFilters` host → `app.tpoker.app` — part of the pre-store native OAuth
     task (§5), together with serving `assetlinks.json` on the new domain.
  3. `PaywallScreen.tsx` + `ProfileScreen.tsx` privacy/terms `Linking.openURL` absolutes →
     `https://app.tpoker.app/*.html`.
  4. `Program.cs` CORS hardcoded fallback → add `https://app.tpoker.app` (defense-in-depth only —
     Railway `AllowedOrigins__0` is the operative fix and is already part of the migration).
  Plus docs: CLAUDE.md deployment section + go-live-runbook env table still name
  `poker-home-games-three.vercel.app` — update both post-merge.
- **Security recommendations (deferred; NOT in PR #11)** — considered and consciously left as recommendations:
  **M3** refresh-token in web `localStorage` (→ HttpOnly cookie), **L1** Google `email_verified`, **L3** AddPlayer
  consent, **L4/L6** config, npm audit-fix (can break Expo). Full detail: memory `security-audit`.

## 7. Key pointers — where the important docs live

> "On main" = you can open it now. "In PR #N" = it lands on `main` when that PR merges at launch.

| Doc | Path | Where | What it's for |
|-----|------|-------|---------------|
| **Go-live runbook** | `docs/release/go-live-runbook.md` | in **PR #4** | Step-by-step for Paddle live + AI Coach + the Railway rate-limit step (§4 detail) |
| **Security deploy note** | `docs/release/security-hardening-deploy.md` | in **PR #11** | The exact Railway `ASPNETCORE_ENVIRONMENT` / forwarded-headers config for the rate-limit fix |
| **Google OAuth fix** | `docs/google-oauth-fix.md` | ✅ **on main** | Web-verified; the required native store OAuth setup |
| **Store release guide** | `docs/store-release.md` | ✅ **on main** | Full App Store + Play submission checklist |
| **Landing deploy** | `docs/release/landing-deploy.md` | in **PR #4** | Deploying the marketing site (already done → tpoker-landing-xi.vercel.app) |
| **Localization plan** | `docs/release/localization-plan.md` | in **PR #5** | Hebrew/RTL blueprint + effort estimate |
| **Backlog tickets** | `docs/release/backlog-tickets.md` | in **PR #4** | The deferred hardening/auth tickets |
| **Study content spec** | `docs/content/study-content-spec.md` | in **PR #5** | The standard for authoring quiz content |

---

**✅ Everything is safely backed up to GitHub — you can close VS Code.** All 4 launch PRs (#4 / #5 / #6 / #11) are
pushed and frozen; the merged work (#7 / #9 / #10 / #12) is on `main`; nothing important lives only on your machine.
When you're back, start at **⏭️ WHEN I COME BACK** at the top. 👋
