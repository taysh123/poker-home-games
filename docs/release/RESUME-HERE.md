# ▶️ RESUME HERE — T Poker status

> **Read this first when you come back.** _Last updated: 2026-08-03, after Q1.6b — Q1 is closed._
>
> This file describes CURRENT state only. It used to carry ~150 lines of a dead Paddle-gated
> launch plan under a "historical, don't act on it" banner — and a new session read the banner,
> skipped past it anyway, and treated the dead plan as live. The fix here is not another banner:
> the dead plan is gone from this file. If you need it for archaeology, it is in git history and
> in `docs/superpowers/specs/2026-06-25-tpoker-launch-design.md` / the free-first pivot design
> below — not here.

## Where we actually are

**iOS 1.1.1 is LIVE on the App Store.** T Poker ships **free-first**: home-game manager, groups,
stats, daily quiz, 3 starter lessons, 10 shared practice questions/day. Premium (full lessons,
unlimited practice, AI Coach, Cloud Sync, advanced bankroll) is **"Coming soon", not purchasable**
— CI-pinned honesty guards keep it that way. Web payments are dead (Paddle rejected poker as
gambling); app-store billing comes later behind the existing `IBillingVerifier` seam. Design of
record: `docs/superpowers/specs/2026-07-18-free-first-split-design.md`.

Building toward **1.2.0**, executing the plan of record —
`docs/superpowers/specs/2026-07-27-product-quality-master-plan.md` (approved 2026-07-27, all 10
owner questions answered 2026-07-28). Execution order: **Q0 → Q1 → Q2 → Q3**, one PR per slice,
adversarial critic fleet before every PR, owner merges.

**Shipped:** Waves 0/1/2 of the earlier product-evolution plan, then from the current master plan
— Q0 (engine-truth fixes), Q1.1 (tier-honest copy), Q1.2 (splash substrate), Q1.3 (SEO/indexing,
`tpoker.app` as the single public entry point), Q1.4 core (review-prompt rules, flag OFF — firing
path is Q1.4b, not yet started), Q1.5a/Q1.5b parts 1–2 (a11y tokens + component contracts + the
AST-measured role ratchet, now 31 unroled touchables across 14 files, down from the pre-Q1.5 debt),
Q1.6 + Q1.6b (TSL byline rows, this rewrite, LICENSE and PRIVACY.md cleanup). **Q1 is fully
closed** as of Q1.6b, owner-confirmed 2026-08-03.

Deliberately NOT part of that close: the TSL byline consolidation into one shared constant (see
below) is tracked as its own small future slice, not a Q1 blocker — the owner decided Q1's
definition of done doesn't require it.

**Next: Q2** (bankroll calendar → bankroll live → training-stats capture → progress dashboard →
"how it works" tour → premium desirability), then Q3. Q2 has a real design fork (per the owner,
2026-08-03) — **stop and check in with the owner before building anything in it**; do not start
from this doc alone. Full slice detail lives in the master-plan doc — not duplicated here, so this
file can't drift from it.

### Q1.6 + Q1.6b — CLOSED, what landed and the one thing deliberately left out

The master plan (`2026-07-27-product-quality-master-plan.md:131-133`) defines Q1.6 as four
sub-items. Stated in detail here because a flat "Q1.6 shipped" line almost shipped in an earlier
draft of this rewrite — the exact failure mode this file exists to stop, reproduced inside the fix
itself, caught by adversarial review before merge. Three of the four items are done; the fourth is
a deliberate, owner-confirmed deferral, not an oversight.

**Landed:**
- **7(i)** "Made by True Story Labs" byline row in Profile's About & Support card — a studio
  credit, not a copyright line; the existing `© Tay Shofer` line is untouched and still the sole
  copyright holder (the app ships under the owner's *individual* developer account, so the legal
  entity on every surface must stay the legal name — `legalSurfaces.test.ts` pins this).
- **7(ii)** Matching "Made by True Story Labs" line in the landing footer's brand column
  (`apps/landing`) — `SITE.company` and the footer's `©` bar are untouched, still `Tay Shofer`.
- **NOT 7(iii)** — store listing copy stays locked verbatim. It was rewritten once after a 2.3.6
  metadata rejection; it does not get touched again without a specific reason.
- This RESUME-HERE.md rewrite — the master plan's "supersede-banner on the stale plan doc" item,
  done as a full rewrite instead of a banner (see the top of this file for why).
- **Q1.6b — `LICENSE`**: was `Copyright (c) 2026 tay123` (a tooling-filled GitHub username
  placeholder, never corrected); now `Tay Shofer`, matching the copyright-holder invariant pinned
  everywhere else.
- **Q1.6b — `PRIVACY.md`** (repo root): was a full duplicate of
  `apps/poker-mobile/public/privacy.html` carrying a "keep both in sync — the two must not drift"
  comment that nothing enforced. Rewritten as a genuine pointer to the canonical served page
  (`https://app.tpoker.app/privacy.html`); the duplication — and the drift risk that comment
  promised to prevent but couldn't — is gone structurally, not just fixed-in-place. Pinned:
  `legalSurfaces.test.ts` asserts the pointer names the canonical URL, never re-duplicates the
  real policy's body (PostHog/bcrypt/GDPR/Railway as proxies), and still names Tay Shofer as
  copyright holder.

**Deliberately deferred, not a Q1 blocker:** the TSL byline consolidation into one shared
constant. The byline exists as FIVE independent literals now, not four: the original
splash/Welcome/Login/in-app-Landing "BY TRUE STORY LABS" bylines, plus Q1.6's two new "Made by
True Story Labs" rows use different capitalization and wording from the other four. Consolidating
was already deferred before Q1.6 added a fifth variant to the pile. Real, and worth doing, but the
owner decided (2026-08-03) it doesn't gate Q1's close — pick it up as its own small slice whenever
the drift actually bites.

## Owner-only open items

Things only the owner can act on — nothing here blocks shipping the rest of the master plan.

- **Android: 0 of 12 closed-test testers recruited.** Play requires ≥12 testers opted in for
  ≥14 continuous days before "Promote to Production" unlocks (`docs/release/dual-store-submission.md`
  §2) — the longest lead time in the whole 1.2.0 release, and it does not depend on which build is
  in the track. **Current plan: pay for testers once the 1.2.0 builds are ready**, rather than
  starting the clock now on an interim build. Worth knowing this diverges from that doc's own
  recommendation ("start the clock today, off `main`, with whatever build is ready, since updating
  the build never resets the 14-day window") — paying for testers after 1.2.0 is a legitimate
  choice, it just means Android's 14-day clock starts later than it technically could.
- **Three Vercel / Search Console actions open**, from Q1.3 (`docs/release/seo-indexing.md` §§1–3):
  1. Flip the `poker-home-games-three.vercel.app` → `app.tpoker.app` redirect from 307 (temporary)
     to 308 (permanent) in the Vercel dashboard — the old domain won't consolidate out of the
     index without it.
  2. Confirm `tpoker-landing-xi.vercel.app` (the landing's early deploy URL) redirects to
     `tpoker.app` rather than serving a duplicate copy.
  3. In Google Search Console: verify both `tpoker.app` and `app.tpoker.app` properties, request a
     temporary removal on `app.tpoker.app` to speed up the `noindex` taking effect, submit
     `tpoker.app/sitemap.xml`, and re-check coverage in ~2 weeks.
- **Two splash taste calls still owed, by the assistant, to the owner** — asked here explicitly so
  they don't sit open silently:
  1. Is **~1.2s** the right splash duration (`components/brand/BrandSplash.tsx`'s `SPLASH.EXIT_AT`
     timing)? Still exactly what it was when this was first raised.
  2. Should **`logo.png`** appear on `WelcomeScreen`? Still absent from that screen today.
- **Branch protection on `main` is enabled** (since 2026-07-29) with all 5 CI checks required.
  Before that, every CI gate was advisory only — worth remembering if an old PR from before that
  date ever needs re-examining for how it actually got merged.

## Key pointers

| Doc | What it's for |
|-----|---------------|
| `docs/superpowers/specs/2026-07-27-product-quality-master-plan.md` | The plan of record — Q0 through Q3, sizes, owner decisions. Read this for "what's next," not this file. |
| `docs/superpowers/specs/2026-07-18-free-first-split-design.md` | Design of record for the free-first split + ship invariants (§5.6). |
| `docs/release/dual-store-submission.md` | iOS/Android 1.2.0 submission plan — the Android 14-day closed-test gate, screenshot regen timing, both stores' step lists. Keep it as the live source for Android testing status rather than this file. |
| `docs/release/seo-indexing.md` | Full detail behind the three open Vercel/Search Console actions above. |
| `docs/store-release.md` | Full App Store + Play submission checklist; publisher identity decision (seller name = Tay Shofer, TSL is an in-app byline only). |
| `docs/google-oauth-fix.md` | Native iOS/Android Google OAuth client setup — required pre-store step, not yet applied. |
| `docs/release/store-submission-readiness.md` | Checklist of what's done vs. still needed for the submission track. |
| `docs/release/backlog-tickets.md` | Deferred hardening/auth tickets (single active session, Cloud Sync xmin hardening, tombstone compaction). |
| `docs/release/localization-plan.md` | Hebrew/RTL blueprint — post-launch, not started. |

## Superseded — kept as a pointer only, not reproduced

The original Paddle-gated launch plan (five frozen PRs, a Paddle re-review, a "when Paddle
approves" launch sequence) is **dead**. Paddle rejected the product as gambling; the free-first
pivot (2026-07-18) replaced it entirely, and every one of those PRs has long since merged or been
abandoned. If you need the details: `git log` on this file before 2026-07-19, or
`docs/superpowers/specs/2026-06-25-tpoker-launch-design.md` for the original design. Do not act on
anything Paddle-shaped you find in either — it does not apply to the current free-first product.
