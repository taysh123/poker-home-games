# T Poker — Product & Business Plan (v1)

> The founder's brief. This is the *what* and the *why*. The companion file
> `TPoker-ClaudeCode-Prompt.md` is the *how* — it hands this plan to Claude Code
> and tells it to turn it into an approved spec + implementation plan + working
> software using the **superpowers** methodology and the **ui-ux-pro-max** design
> skill.
>
> Save this file into the repo at `docs/product/business-plan.md` so Claude Code
> can read it.

---

## 0. One-line thesis

**T Poker is a free home-game club app that quietly turns weekly poker nights into
a paid poker-improvement habit.** The social tool is the hook (everyone at the
table uses it, every week); the training platform is the business.

---

## 1. The product in one picture — a two-sided funnel in one app

```
        ┌─────────────────────────────────────────────┐
        │   TOP OF FUNNEL  ·  FREE FOREVER  ·  the hook │
        │   Home-game management                        │
        │   cash + tournament tracking, settlements,    │
        │   groups, stats, achievements, podium share   │
        │   → viral (invite links), weekly retention    │
        └───────────────────────┬─────────────────────┘
                                 │  players who get hooked
                                 │  want to get BETTER
                                 ▼
        ┌─────────────────────────────────────────────┐
        │   CONVERSION  ·  PREMIUM  ·  the business     │
        │   Training platform                           │
        │   Study (lessons, quizzes, spot trainer),     │
        │   AI Coach (phase 2), Solver-verified GTO     │
        │   (phase 4), advanced bankroll, cloud sync    │
        └─────────────────────────────────────────────┘
```

Both halves already share one Expo codebase (iOS / Android / Web). The home-game
half is essentially built and launch-ready; the training half is heavily built
but gated `comingSoon` because nothing is charged for until it is genuinely live.

**Why this funnel is strong for a solo founder with ~no budget**
- The hook spreads itself — every invited player is a new install, no ad spend.
- It is used *every week*, so the app earns a place on the home screen.
- GTO Wizard / DTO have **no** home-game layer — this is a real differentiator,
  not a clone.
- The free tool builds the audience; the paid tool monetizes the subset that
  wants to improve.

---

## 2. Business model

**Model:** Freemium subscription. Free tool drives acquisition + retention; a
single Premium tier monetizes the training platform.

**Pricing (already wired in `premium/config.ts` — keep it):**

| Plan | Price | Notes |
|------|-------|-------|
| Free | $0 forever | Whole home-game product + a real taste of training |
| Premium (monthly) | **$11.99 / mo** | Full training platform |
| Premium (yearly) | **$99.99 / yr** (~$8.33/mo, 30% off) | Anchored as the "smart" choice |

**Billing rails (already scaffolded, dormant, fail-closed):** Stripe on web,
RevenueCat on mobile, behind a vendor-agnostic `IBillingProvider` seam. **Launch
web-first with Stripe** — no app-store revenue cut, fastest to switch on, and the
web build already deploys to Vercel.

**Why one tier, not three:** A solo founder cannot maintain a Basic/Pro/Ultra
matrix honestly. One free, one paid, one decision. Add tiers only if data later
demands it.

---

## 3. Free vs Premium — the honest split

This is the most important table in the document. It is built around one rule
(Section 6): **you never charge for something that isn't genuinely live.**

| Capability | Free | Premium |
|------------|:----:|:-------:|
| **Home-game management** (cash, tournament, settlements, groups, stats, achievements, podium share) | ✅ everything | ✅ |
| Study — **starter lessons** (e.g. preflop fundamentals, a curated module) | ✅ | ✅ |
| Study — **daily quiz** (one per day, streak-building) | ✅ | ✅ |
| Study — **Spot Trainer** | ✅ limited daily reps | ✅ unlimited |
| Study — **full lesson library + all quizzes + unlimited trainer** | — | ✅ **(launch paid value)** |
| AI Coach — **lifetime taste** | ✅ 1 analysis (verified accounts only; guests 0) | — |
| AI Coach — **30 analyses / month** | — | ✅ *(phase 2 — ships when genuinely live)* |
| Advanced bankroll analytics (variance, filters, trends) | basic stats only | ✅ *(ships when live)* |
| Cloud sync across devices | — | ✅ *(ships when live)* |
| **Solver-verified GTO packs** | — | ✅ *(phase 4 — only after written redistribution rights)* |

**The launch paid offering = "Premium Study"**: the full lesson library + all
quizzes + unlimited Spot Trainer, built on the `Calibrated`/`Consensus` content
that already ships in `assets/content/0.8.1`. It is real, it is ready, it costs
nothing per use, and it carries zero hallucination/legal risk. Everything else in
the Premium column is marked **"Soon"** in the paywall and only moves into the
paid bundle the day it genuinely ships.

---

## 4. Feature catalog — the App (Expo: iOS / Android / Web)

**Already built (home-game core — keep, polish, don't rebuild):**
- Guest mode (no account) → run a full cash or tournament night on-device
- The Final Count (guided cash close-out + live balance check)
- Minimal-transfer settlement engine (C# + TS port, shared test fixtures)
- Tournament director (payouts, blind structure, stored clock, rebuys/add-ons,
  late reg, live dashboard, bust-outs, early-finish ranking)
- Groups (roles, invite links, activity feed, rivalries, leaderboards,
  14 achievements, weekly digest)
- Lifetime stats, podium share cards, PDF recaps
- Auth (JWT + refresh rotation, Google OAuth), notifications (in-app + push)

**Built, to be finished & switched on (training):**
- **Study tab** — lesson modules, lesson reader, quiz runner, spot trainer
  (`features/study/`)
- **Solver workspace** — range grid, hand inspector, fail-closed pack import
  (`features/solver/`) — consumes *illustrative/Calibrated* ranges; `solver`
  flag stays OFF until rights land
- **AI Coach** — input → grounded analysis → result, credits per tier
  (`features/coach/`) — phase 2
- **Premium** — paywall, pack catalog, entitlements, billing seam
  (`features/premium/`)
- **Mastery & engagement** — attempt tracking, XP, achievements
  (`features/mastery/`, `features/engagement/`)

**Launch (Phase 1 + 2) app scope:**
1. Finish + ship the free home-game funnel (it's the acquisition engine).
2. Switch on **Premium Study** behind the paywall (full library + unlimited
   trainer) — the first real paid value.
3. Keep AI Coach / solver / cloud sync visibly **"Soon"** (honest), not charged.

---

## 5. Feature catalog — the Website

The web build is the **same Expo codebase exported to web** (already on Vercel).
But a commercial training platform's website has **three** jobs, not one:

1. **The web app** — identical product to mobile, for desktop study sessions
   (range grids and lessons are genuinely nicer on a big screen).
2. **A marketing surface** — a real landing page + a pricing page that explain
   the two-sided value (club tool + training) and drive signup / checkout.
   This is where Stripe web checkout lives.
3. **An SEO content surface** — public, indexable pages (a public spot library,
   free lesson previews, strategy articles) that pull in organic search traffic
   and funnel anonymous readers into signup. The repo already has design docs for
   this (`docs/product/seo-content-platform-architecture.md`,
   `public-spot-library-architecture.md`). **For a zero-ad-budget launch, SEO is
   the primary growth channel besides home-game virality** — so the website is a
   growth asset, not just a place the app happens to run.

**Launch website scope:** web app (done) + a focused landing/pricing page +
Stripe checkout. SEO content pages are a **fast-follow** (Phase 3) — high ROI,
but not a blocker for first revenue.

---

## 6. The honesty gate (non-negotiable — it's already your architecture)

This principle already runs through the whole codebase (`comingSoon` flags, the
`solver`-OFF default, the `VerificationTier` vocabulary, the refusal to label
anything `Solver-Verified` without a real run). The business plan inherits it:

- **Never charge for a `comingSoon` feature.** The paywall renders a "Soon" chip
  on anything unbuilt and never presents it as an available benefit.
- **At launch, the Premium bundle must contain ≥1 genuinely-live paid thing.**
  That is Premium Study. Without it, the paywall stays off.
- **`solver` tier = real solver output only.** Until written redistribution
  rights land (per your own `vendor-reply-playbook.md`), the workspace shows
  *illustrative/Calibrated* ranges, clearly labelled.
- This is not just ethics — it's also what keeps you out of refund disputes,
  app-store rejections, and false-advertising exposure.

---

## 7. Design direction — "Velvet Table", extended (don't reinvent)

You already have a strong, shipped design language. The job is to extend it
**consistently** to the new training surfaces, governed by `ui-ux-pro-max`'s
`design-system` (tokens) + `brand` skills — not to restyle what works.

**Established language (keep):**
- Type roles: **DM Serif Display** (hero numerals + display titles) · **Sora**
  (headings, labels, UI chrome) · **Inter** (body + tabular figures)
- Deep-navy surfaces, restrained **gold** accents, glass on iOS, shimmer loading
- Signature moments: bankroll hero, game-over celebration, tournament podium,
  rarity-tinted achievement unlock, "Deal 'Em In" start transition
- The T Poker logo as a persistent home anchor on every screen

**Non-negotiable design rules to bake into every new surface (from ui-ux-pro-max,
priority order):**
1. **Accessibility (critical):** 4.5:1 text contrast, visible focus rings,
   `prefers-reduced-motion` respected, screen-reader labels, no info by color
   alone.
2. **Touch (critical):** 44×44pt minimum targets, 8px+ spacing, loading feedback
   on every async action.
3. **Performance:** reserve space (CLS < 0.1), lazy-load, WebP/AVIF.
4. **Style consistency:** one coherent style; **SVG icons, never emoji as icons**.
5. **Layout:** mobile-first; bottom nav ≤ 5 items; no horizontal scroll.
6. **Typography/Color:** base 16px, line-height ~1.5, **semantic tokens — no raw
   hex in components**.
7. **Animation:** 150–300ms, motion that conveys meaning, reduced-motion aware.
8. **Forms/Feedback:** visible labels (not placeholder-only), errors near the
   field.

**New training surfaces that need design (extend the system to them):**
- Study home / module list / lesson reader / quiz runner / spot trainer
- Range grid + hand inspector (data-dense — this is where charts & color rules
  matter most; color must never be the only signal)
- Paywall + pricing page + pack catalog (conversion surfaces — clarity of value,
  honest "Soon" chips)
- The marketing landing page (web)

---

## 8. The funnel, mapped to what's already built (AARRR)

| Stage | Mechanism | Status |
|-------|-----------|--------|
| **Acquisition** | Home-game invite links · App Store presence · SEO content pages (web) | links ✅ · stores ⏳ · SEO ⏳ (Phase 3) |
| **Activation** | Guest mode → first game in 30s · first free lesson + daily quiz | game ✅ · study taste ⏳ (Phase 1) |
| **Retention** | Weekly "Your Week at the Club" digest · daily quiz streak · XP/achievements | digest ✅ · streak engine ✅ (wire to study) |
| **Revenue** | Paywall on full Study library · (later) AI Coach | seam ✅ · switch-on ⏳ (Phase 2) |
| **Referral** | Invite links · podium share cards | ✅ |

The striking thing: **most of the funnel already exists.** Launch is mostly
*finishing and switching on*, not building from scratch.

---

## 9. Phased roadmap — Phases 1 + 2 are "the plan"

**Phase 1 — Ship the free funnel (acquisition engine). Target: live, $0 spend.**
- Finish/QA the home-game product to store-submittable quality (web first, then
  EAS builds for stores).
- Wire the **free training taste**: starter lessons + daily quiz + limited Spot
  Trainer reps, using shipped `Calibrated` content.
- Wire the engagement loop (XP/streak) to study activity.
- **Outcome:** a polished free app people invite their friends to and open weekly.

**Phase 2 — Switch on Premium Study (first revenue). Target: first paying users.**
- Define Premium Study entitlement: full lesson library + all quizzes + unlimited
  Spot Trainer.
- Connect the paywall to *only* that live value; keep everything else "Soon".
- Turn on **Stripe web checkout** (key-gated adapter → live); server is the
  authority for entitlements (`SERVER_AUTHORITATIVE = true` already).
- Build a focused **landing + pricing page** for the web funnel.
- **Outcome:** a free user can upgrade and unlock real, live training value.

**Phase 3 (fast-follow) — SEO content surface.** Public spot library + free
lesson previews + a few strategy articles → organic growth. High ROI, low cost.

**Phase 4 (when it pays for itself) — AI Coach live, then Solver-verified GTO.**
AI Coach ships once revenue covers the Anthropic API per-use cost (adapter built).
Solver-verified packs ship only after written redistribution rights (PioSolver /
UPI path per your `vendor-reply-playbook.md`) — the long-term moat, never a launch
blocker.

---

## 10. Costs — what "minimum investment" actually means

| Item | Cost | When |
|------|------|------|
| Web hosting (Vercel) + backend (Railway) | already running | now |
| Stripe | $0 upfront; ~2.9% + $0.30 per transaction | Phase 2 |
| Apple Developer Program | $99 / year | only if/when shipping to iOS store |
| Google Play Console | $25 one-time | only if/when shipping to Android store |
| AI Coach API (Anthropic) | per-use; **funded by revenue** | Phase 4 |
| Solver license + redistribution rights | $100–$500+ (PioSolver path) | Phase 4 |
| **Phases 1 + 2 total out-of-pocket** | **≈ $0–$124** | launch |

Launch costs essentially nothing. The expensive items (AI API, solver) are
deferred until revenue exists to pay for them. **That is the whole point of the
phasing.**

---

## 11. Risks & honest expectations

- **Competitive market.** GTO Wizard/DTO are entrenched in training. Your edge is
  the home-game funnel they don't have, a Hebrew-first option, and price. Don't
  try to out-solver them on day one.
- **Revenue is not guaranteed.** A solo-founder poker app making real money is
  possible but uncertain. The right goal for launch is *a handful of paying users
  and what you learn from them* — not "get rich." Phasing keeps the downside near
  zero.
- **The home-game/training split is two products in one repo.** Manage scope
  ruthlessly (YAGNI). Ship the funnel, switch on one paid thing, learn, iterate.
- **Gambling positioning.** Keep the "not a gambling product / 18+ / scorekeeping
  only" stance (already in README/PRIVACY) crisp for store review.

---

## 12. Success metrics (what to watch, not vanity)

- **Activation:** % of installs that finish a first game; % that open a first
  lesson.
- **Retention:** weekly active / install; quiz-streak length.
- **Virality:** invites sent per active group; installs per invite.
- **Revenue:** free→Premium conversion %; trial→paid; monthly churn.
- **Honesty health:** zero paid features in `comingSoon`; zero `solver`-tier
  content without a recorded run.

---

### TL;DR for the build

Ship the **free home-game funnel** (Phase 1) → switch on **Premium Study** with
**Stripe web checkout** and a **landing/pricing page** (Phase 2). Keep AI Coach,
cloud sync, and solver-verified GTO **honestly "Soon"** until they genuinely ship
(Phases 3–4). Cost to launch: ≈ $0. Everything is built on top of what already
exists — this is a finishing-and-switching-on job, governed by the honesty gate.
