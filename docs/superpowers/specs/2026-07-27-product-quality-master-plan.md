# Product-Quality Master Plan — "Make it feel like a studio product"

- **Date:** 2026-07-27 · **decisions recorded 2026-07-28** (see §4-ANSWERED)
- **Status:** APPROVED (PR #58 merged 2026-07-27; all 10 §4 questions answered 2026-07-28).
  Execution order per owner: **Q0 → Q1 → Q2 → Q3.** Per-slice rules: TDD · adversarial critic
  fleet before EVERY PR · one PR per slice · owner merges · commit/push working state BEFORE
  running agent fleets (quota-resilience rule, owner 2026-07-28).
- **Relationship to prior specs:** extends the product-evolution master plan
  (`2026-07-22-product-evolution-master-plan.md`) post-launch. Its ship invariants remain binding
  on every slice here: **nothing purchasable anywhere; AI Coach makes zero API calls; all premium
  is "Coming soon"; guests keep the full free experience; honesty CI pins are extended, never
  weakened; the store track is never blocked.** Wave-2 leftovers it inherits: **2.2 Results
  Card 2.0** (still unbuilt — a hard dependency of Q3 shareables and of 2.4's held card-preview
  step) and the **E.1 registry migration** (held for 2.2 by owner decision 2026-07-24 — folded
  into Q2.7 here).
- **Provenance:** 13-agent code exploration (2026-07-27) + inline area sweeps; every claim below
  was verified against the code, not assumed. Per-slice **execution plans** (full TDD steps) are
  written at build time via superpowers:writing-plans; visual slices get **ui-ux-pro-max taste
  options (2–3 directions)** presented before their build, per house convention.

## 1. What exploration changed about the brief (read this first)

The owner's request assumed several things need *building*. The codebase says otherwise:

1. **Bankroll (J) is already built.** `features/bankroll/` is a complete, tested, device-local
   tracker — external-session logging (venue, duration, cash/tournament detail, fees, tags,
   notes), ROI/win-rate/$-per-hour, variance/std-dev/max-drawdown, histogram, line chart, type +
   source filters — **flag `bankroll` OFF in prod.** Area J is therefore *calendar + polish +
   premium-boundary decision + flag flip*, not a ground-up pillar build.
2. **A range workspace (E) is already built.** `features/solver/` — RangeGrid, per-hand
   inspector, compare mode, pack import with verification tiers (`solver`/`calibrated`/
   `illustrative`), saved spots, registered in BOTH trees, deep link `/solver` — **flag `solver`
   OFF in prod.** Area E is *library UX + content + honest labeling*, not an engine build.
3. **Branding (N) is already decided and shipped.** Publisher identity was LOCKED 2026-07-23:
   Tay Shofer is the seller/©/operator everywhere the law looks; "True Story Labs" is the studio
   byline on splash/Welcome/Login/landing carousel + the contact brand. What remains is hygiene
   plus optional extra TSL visibility (§4 Q7). **Nothing can make Apple show "True Story Labs"
   as the seller under an individual account — the DBA route was explicitly not pursued.**
4. **Onboarding (C) is not what CLAUDE.md says.** OnboardingV2 is the Wave-1 persona *quiz
   funnel* (promise → goal → skill → format → name → action router), already retakeable via the
   `PersonaQuiz` route. A tutorial must be an *additive tour*, not another funnel.
5. **Real latent bugs surfaced** (fixed in Q0): the XP achievement term is **non-monotonic**
   (violates the Wave-0.4 pin's intent — a broken streak silently drops XP by 25–50 and can
   re-fire rank-up celebrations); `lessonsCompleted` increments on every lesson *open* (inflates
   XP); `EngagementContext` buckets "positive month" by **UTC** month; broken-streak badges
   visually re-lock in AchievementsScreen.
6. **The app web host is the worst of both SEO worlds** (M): `app.tpoker.app` serves an *empty,
   head-less JS shell at every URL* (SPA rewrite, no canonical/description/robots meta anywhere)
   while its robots.txt+sitemap *invite* indexing; the old
   `poker-home-games-three.vercel.app` 307 (temporary) redirect never transfers signals, so the
   old domain can stay indexed forever. The landing (`tpoker.app`) is well-formed.

## 2. Conflicts with the request — surfaced, not silently resolved

- **"Range tables", not "solver tables" — and the disclaimers can't just die (A/E).** The
  content is expert-calibrated/illustrative, not solver-derived; CI pins ban solver-verified
  claims below a ≥95% verified threshold. Proposal: lead with what it IS. The surface is named
  **"Ranges"**; every table carries a small tier chip (**Expert-calibrated** / **Illustrative** /
  **Solver-verified** only when imported packs genuinely are); the apologetic footnotes go away.
  Exact copy swaps + pins to update in §3 Q1.1. The claim never becomes "solver output" — the
  framing becomes confident instead of defensive. This is honest because the chip still states
  the tier on the table itself.
- **Premium range library vs "nothing purchasable":** locked premium ranges show the standard
  LockNudge "Coming soon" treatment (no purchase path) until billing ships. Free users get a
  meaningful subset (§3 Q3.4).
- **"True Story Labs as developer wherever possible" (N):** in-app and marketing surfaces —
  yes, mostly already done, with a little headroom left (§4 Q7). Store seller field — impossible
  under the individual account; saying otherwise would misrepresent the seller of record.
- **Review prompts (G):** iOS caps `requestReview` at ~3/year and may silently no-op — the
  design uses our own eligibility + sentiment pre-gate and never depends on the dialog showing.

## 3. The plan — three quality waves + a fix pack

Sizes: S ≤ 1 day · M ≈ 1–2 days · L ≈ 2–3 days (split before build if it grows).
"📸" = touches screenshotted surfaces (feeds the single regen batch, Q3.7).
Every slice: feature branch → TDD → gates (tsc · jest · expo export · landing build when touched
· a11y/reduced-motion/web-parity) → adversarial review → small PR → owner merge.

### Q0 — Fix pack (first PR, S)
- **Q0.1 Engine-truth fixes:** XP achievement term counts *seen* (permanent) achievements —
  restores monotonicity + new pin test; AchievementsScreen `earned = seen || eligible`;
  `lessonsCompleted` fires once per module (persisted per-module set) on real completion;
  EngagementContext month key → local components. Delete dead code:
  `screens/SplashScreen.tsx`, `bankroll/ui/BankrollChart.tsx`, `assets/true-story-labs-logo.png`.

### Q1 — Perception wave (~1.5 weeks; the app *feels* different immediately)
- **Q1.1 Copy pass (A) — M 📸.** Remove the repeated "Stored on this device — no account
  needed" chrome from trainers/quizzes/spots/wizard (`LocalNewGameScreen:267` badge et al.);
  the privacy point lives ONCE — quietly in Profile ("Everything here stays on your device")
  and the onboarding router sub-line. Disclaimer reframe (kept truthful):
  · SpotTrainer `Illustrative training range — not solver output.` → chip **Expert-calibrated
    range** (tier chip already exists as a pattern in QuizRunner)
  · StudyScreen dataset line → `Expert-calibrated training ranges — import solver packs
    anytime.`
  · QuizRunner hero `· educational, not solver output` → dropped (the Calibrated-reference
    chip stays).
  · AI-Coach + share-card + landing copy: UNTOUCHED (separately pinned; already confident).
  Pins updated deliberately: any test matching the removed phrases; the `isIllustrative ⇒ UI
  labels it` rule is preserved via the chip. Plus a general sweep for apologetic/parenthetical
  copy (inventory in exploration notes).
- **Q1.2 First impression (B) — M.** New dedicated splash asset (transparent badge, correct
  #0A111B canvas — today's is a byte-identical 2.2MB copy of icon.png with a wrong-color baked
  background); adopt `expo-splash-screen` (preventAutoHide → deliberate reveal); release the
  SplashGate at EXIT_AT so Welcome rises *during* the dissolve (kills 300ms of dead air; pinned
  timeline tests updated deliberately); one shared brand-lockup component for splash+Welcome;
  eased exit curves; fix the reduce-motion first-frame leak. Taste options at build time.
- **Q1.3 SEO/indexing (M) — M.** App host: post-export head-inject (description, canonical,
  OG/Twitter) in the Vercel build command; `noindex` the shell on non-policy paths
  (X-Robots-Tag via `apps/poker-mobile/vercel.json` headers); `Disallow: /join/` in robots.txt
  (single-use invite tokens must never index); drop the shell from sitemap.xml; self-canonicals
  + missing descriptions on the four policy pages. Landing: JSON-LD (SoftwareApplication +
  FAQPage, wording passes the positioning pins); differentiated shell vs landing titles.
  Owner dashboard actions (documented in the slice): flip the old-domain 307 → 308, verify
  `tpoker-landing-xi` redirects. README/CLAUDE.md old-domain cleanup.
- **Q1.4 Ratings & feedback (G) — M.** `expo-store-review` + pure `reviewPromptLogic`
  (TDD-first: qualifying moments = fresh game summary / drill ≥70% / achievement-unlock
  dismissed / 7-day streak; ≥3 qualifying moments, install-age floor, 90-day cooldown, once per
  version, never mid-task, never over a celebration — joins the existing sequencing). Sentiment
  pre-gate ("Enjoying T Poker?"): happy → native review request; not happy → feedback path
  (prefilled support mail v1). New flag `reviews` (+ features.test.ts), typed events, support
  email centralised into one constant.
- **Q1.5 Visual-system hygiene (D) — M.** Promote the 6 remaining hex offenders to a shared
  rank/rarity color util (silver/bronze medals duplicated in 2 screens; rarity colors already
  exist as tokens); close the a11y gap on the 9 zero-a11y screens + 3 role-gap screens (form
  screens first — worst for screen readers); add a ban test in the house style (frozen
  allowlist, counts can only go down) for raw hex + raw fontSize in screens/.
- **Q1.6 Branding hygiene (N) — S.** LICENSE © → Tay Shofer; PRIVACY.md → pointer at the
  canonical page (kills silent drift); TSL byline → one shared constant + pins on all four
  surfaces; supersede-banner on the stale landing-marketing plan doc.

### Q2 — Pillars wave (~2 weeks; Track + progress become real product pillars)
- **Q2.1 Bankroll calendar (J) — L 📸.** Pure `logic/` day/month bucketing (local day keys) →
  month calendar view (played-day markers, tap-through to sessions/log) + year heatmap +
  monthly P&L strip; filters reuse the existing `BankrollFilter` (cash/tournament + source
  already ship; date-range/tags get UI). Charts follow the house SVG static pattern (a11y
  label, reduced-motion safe). Taste options at build time.
- **Q2.2 Bankroll logging polish (J) — M.** Stakes inputs (schema fields already exist), honest
  rebuy/add-on counts, notes surfaced (expandable row/detail), **prefill from a finished local
  game** ("Log to Bankroll" currently opens an empty form — route param carries the game's
  numbers, `source: 'in_app'`).
- **Q2.3 Bankroll goes live (J) — S 📸.** Premium boundary decision (§4 Q2) implemented; flip
  `bankroll` in PROD_FLAGS (+ `expectedOn`); Track tab leads with Bankroll. Recommended split:
  **free = logging + calendar + core stats (net, win rate, monthly P&L); premium-later =
  exactly what the pinned benefit already names ("Variance, filters & deeper trends" — the
  variance/drawdown/histogram/deep-filter section gets the honest Coming-soon lock).** That
  makes the currently-ironic benefit truthful without taking anything a free user has today
  (the screen was never live).
- **Q2.4 Training-stats capture (I) — M.** StudyProgress v3 (additive): per-day
  `{answered, correct}` (one line in `recordAnswer`); `recordQuizFinished` persists the
  per-category breakdown (`runBreakdown` already computes it); Spot answers record
  scenario/position keys into the mastery-shaped aggregate. Composed writes only (the
  twice-shipped chained-write bug class is pinned).
- **Q2.5 Progress dashboard (I) — L 📸.** "Training" section on StatsScreen + StudyScreen
  trendline: accuracy trend (day-bucketed, honest "since <date>" framing), active days, study
  volume, strong/weak categories once ≥N attempts (mastery thresholds reused), placement
  baseline → "retake your level check" arc. Sparse-data states designed, not apologised for.
- **Q2.6 "How T Poker works" tour (C) — M.** A 4-card visual tour route (registered in BOTH
  trees like PersonaQuiz): what T Poker is · Home Games/Quick Game · Decision Trainer/daily
  quiz · Track + Premium-coming. Offered once post-funnel (one-shot key set at the funnel's
  four exit seams — funnel untouched), re-openable forever from Profile ("How T Poker works"
  row beside "Retake the setup quiz"). Extends the Wave-1 funnel; zero duplication.
- **Q2.7 Premium desirability (F) — L.** Rebuild the flag-OFF paywall *preview* into a real
  product page (per-pillar benefit sections with real screenshots, which-lands-first framing,
  free-taste cross-links; honest Coming-soon ribbon; still zero purchase UI — pins intact).
  Wire the E.1 registry: LockNudge/Profile/lessons read copy from `TRIGGER_REGISTRY`
  (kills the live copy-drift), cooldowns actually consulted (`shouldShowNudge`), locked lesson
  rows tap through to the preview (the profile-teaser precedent), ship the approved
  `coach_teaser` card, type the Paywall route param as `TriggerId`, declare `purchase_pending`.

### Q3 — Library & delight wave (~2–3 weeks)
- **Q3.1 Results Card 2.0 as a card SYSTEM (K + Wave-2's 2.2) — L 📸.** One navy+gold branded
  card *framework* (brand header, content slot, pinned honesty footer "Friendly home game ·
  settled in cash, in person") with the game-results template first: all players, group
  branding, currency util (kills hardcoded ₪), server adapter producing the `gameResults`
  shape, retires the "PokerHome" PDF, adds the missing share analytics on every path, and an
  on-demand preview modal (replaces the off-screen capture hack). This unlocks 2.4's held
  card-preview step. Positively pin the honesty footer (today only the pot-idiom ban exists).
- **Q3.2 Share templates (K) — M.** Training-result, streak-milestone, and achievement cards on
  the framework. Study shareables are the *safest* viral surface for our store classification —
  they lead the copy.
- **Q3.3 Ranges library UX (E) — L.** Library IA over the existing workspace: category groups
  (RFI / vs-RFI / 3-bet …), search, position/stack filters, favorites + recently-viewed
  (savedSpots pattern), tier chips everywhere, locked premium sets shown as attractive blurred
  previews with the standard Coming-soon lock. Naming: **"Ranges"**. Taste options at build.
- **Q3.4 Ranges content + go-live (E) — M + owner authoring.** Owner authors the
  expert-calibrated sets (same motion as evolution-plan decision 8; the pack-import format is
  the authoring vehicle); free tier = a genuinely useful subset (recommend: full RFI family
  free, advanced spots premium-locked); flip `solver` flag (+ expectedOn) once the library has
  content worth shipping.
- **Q3.5 Retention additions (H) — L.** On the EXISTING engine only: daily challenge (pure fn
  over StudyProgress + one composed write + date-seeded selection via `dailyRotation`,
  surfaced by StudyScreen goal ring + Home chip); milestone tiers as data rows in
  `LOCAL_ACHIEVEMENTS` (rebalanced toward prod-live signals — 4 of 10 current badges are
  unreachable in prod); personal bests as a pure selector + "new record" celebration; a small
  celebration queue replacing the hardcoded 5500/2000ms collision constants; the rank-up
  moment upgraded to an AchievementUnlock-style card.
- **Q3.6 Visual deep pass (D/L) — M..L, sliced per screen.** Tokenise raw fontSizes on the
  worst offenders (LocalSessionScreen 28, LocalNewGameScreen 24, NewGameScreen 15 — 
  SessionScreen's 101 ride along with the deferred 2.1 extraction, never standalone churn);
  migrate legacy-Animated entrances opportunistically when a screen is touched; converge
  GroupListItem/SessionListItem into ListRow.
- **Q3.7 Store refresh — S.** ONE screenshot-regen batch (`store-shots.mjs`, all four size
  profiles) + listing-copy review after Q1.1/Q2.3/Q2.5/Q3.1 land, feeding the 1.2.0 dual-store
  submission (its plan already schedules this — `dual-store-submission.md` §4). Store
  screenshots are deliberately NOT regenerated per-slice.

### O — Full product review
After Q1 lands (the fastest perception change), a fresh full-app audit pass (critic fleet +
hands-on walkthrough) hunting: remaining clutter, unclear flows, conversion dead-ends,
inconsistency, missed premium moments. Its findings feed Q2/Q3 backlogs. (First findings
already folded in: the paywall preview dead-end, notification-tap dead route for guests
(fixed in 2.4), splash triple-brand, prefs screen shown on web where reminders can't fire.)

## 4-ANSWERED. Owner decisions (2026-07-28) — the questions below are RESOLVED

1. **(Q1.1) → (a).** Tier chips replace the "not solver output" footnotes; the on-device privacy
   line survives only in Profile + the onboarding router.
2. **(Q2.3) → (a).** Bankroll free = logging + calendar + core stats (net, win rate, monthly
   P&L); premium-later = the pinned "Variance, filters & deeper trends" set (variance/std-dev/
   drawdown/histogram/deep filters) behind the honest Coming-soon lock.
3. **(Q3.3/3.4) → "Ranges"** naming; **full RFI family free**, advanced spots locked; owner
   authors/curates content. AMENDED by the content finding below: most v1 content already
   exists — see §4b.
4. **(Q1.4) → (a).** Sentiment gate → store review / prefilled support email. In-app feedback
   form deferred to its own later slice.
5. **(Q2.7) → (a).** Locked lesson rows route to the paywall preview.
6. **(Q1.2) → (a).** Splash cross-fade approved: SplashGate releases at EXIT_AT (900ms); the
   pinned timeline tests are updated deliberately in that slice's PR.
7. **(N headroom) → (i) YES + (ii) YES + (iii) NO.** Profile About gets a "Made by True Story
   Labs" row; the landing footer gets a TSL brand line (© stays Tay Shofer). The store long
   description is NOT touched — that copy was carefully written after a 2.3.6 metadata rejection
   and is not worth churning for a branding mention. (Store-listing copy stays locked verbatim.)
8. **(Sequencing) → (a).** Q1 perception → Q2 pillars → Q3 library.
9. **(Q3.5) → (a).** Retro milestone unlocks: celebratory queue capped at 3, rest seeded silent.
10. **(Q3.1/2.2 timing) → (a).** Results Card 2.0 stays at Q3.1.

### §4b. Range-content finding (2026-07-28) — Q3.4 re-scoped from "author" to "convert + curate"

`content/release-0.8.1/exports/0.8.1/packs/range_viewer_database.pack.json` holds **31 complete
169-hand grids (5,239 rows — exactly 31 × 169), ALL ProductionReady=Yes and Status=Approved**:
5 RFI (UTG/HJ/CO/BTN/SB 100bb 6-max) · 4 BB-defense (vs BTN/CO/HJ 2.5bb + BvB 3bb) · 8 3-bet ·
3 facing-3-bet · 3 4-bet · 2 facing-4-bet · 2 squeeze · 4 push/fold (10–12bb, **Nash-Solved**).
**No tier mixing inside any scenario** (27 uniformly Calibrated, 4 uniformly Nash-Solved), so
per-range tier labeling is clean and honest. Encoding: one row per hand — pure or single-action
mixed frequency (`Raise (mixed)` + Frequency, remainder = fold), which maps 1:1 onto the app's
`HandStrategy`. Converter = a pure build-time tool (rows → grouped scenarios → SolverPack JSON
through the EXISTING fail-closed `importPack` validation), plus an additive extension of the
app's `RangeScenario` union ('RFI' | 'vs_RFI' today → + 3bet/vs_3bet/4bet/vs_4bet/squeeze/
push_fold) — estimated **S–M (~1 day) with TDD fixtures**. Free tier per decision 3: the 5 RFI
grids; the other 26 ship as locked Coming-soon previews.
**Honesty caveat:** Nash-Solved rows carry NO `SolveConfigID` (provenance incomplete). Until the
owner backfills solve provenance for the 4 push/fold charts, the converter maps Nash-Solved →
the app's 'calibrated' tier (under-claiming is honest; over-claiming is not). The other range-ish
databases (icm_decisions 1,620 rows, bb_defense 536, flop_cbet 224, …) are group-level guidance,
not per-hand grids — future lesson/inspector enrichment, not Q3.4 feedstock.
Owner authoring is now OPTIONAL EXPANSION only: deeper MTT stacks (15–40bb), vs-UTG defense,
9-max/HU — none required for v1.

## 4-HISTORICAL. Open questions as originally posed (answers above)

1. **(Q1.1)** Approve the copy direction: tier chips ("Expert-calibrated range") replace the
   "not solver output" footnotes; the on-device privacy line survives only in Profile +
   onboarding. Any surface you want it kept on?
2. **(Q2.3)** Premium boundary for bankroll — approve "core free / variance+deep-filters
   premium-later" (matches the pinned benefit copy), or keep 100% free at flip time?
3. **(Q3.3/3.4)** "Ranges" naming OK? And free-subset shape: full RFI family free, advanced
   spots locked — confirm, and confirm you'll author the sets (it's the decision-8 motion).
4. **(Q1.4)** Feedback path v1 = prefilled support email (zero server). An in-app feedback form
   (bug/feature/comment → server) can be a later slice — want it pulled forward instead?
5. **(Q2.7)** OK to route locked lesson rows to the paywall *preview* (second sanctioned
   tap-through; sells nothing)?
6. **(Q1.2)** The splash cross-fade needs the pinned timeline tests changed (gate releases at
   900ms instead of 1200ms) — approve that deliberate pin change?
7. **(N headroom — optional)** Which extra TSL surfaces do you want: "Made by True Story Labs"
   row in Profile's About card · TSL brand line in the landing footer (© stays Tay Shofer) ·
   "from True Story Labs" sentence in the store long description (needs your store-release.md
   edit)? Any/all/none — none are required.
8. **(Sequencing)** Q1→Q2→Q3 is impact-per-effort from where I sit; say the word if you want
   Bankroll (Q2.1–2.3) promoted ahead of Q1's polish wave.
9. **(Q3.5)** When new milestone badges land, existing users may retro-unlock several at once —
   celebrate the backlog (one queued sequence) or seed silently like first-run? I recommend one
   celebratory queue capped at 3, rest silent.
10. **(Q3.1)** 2.2 Results Card was a Wave-2 item; here it anchors Q3. If you want the 2.4
    card-preview funnel completed sooner, 2.2 can swap with Q2.7 — your call.

## 5. Risks

1. **Pin churn:** Q1.1/Q1.2/Q3.1 deliberately update honesty/timeline pins — each PR must show
   the pin diff explicitly (extended, never weakened) for review.
2. **Store re-review exposure:** Q1.1 changes screenshotted copy → the single Q3.7 regen batch
   must precede the next submission; education-first posture is unchanged by design.
3. **Flag flips** (`bankroll`, `solver`, `reviews`) each extend `features.test.ts expectedOn`
   in the same PR; every flip is a kill-switch if anything looks wrong in prod.
4. **SessionScreen fragility:** all Q-slices stay off the 3.1k-line monolith except the already
   -shipped 2.4 card; its cosmetic debt rides with the deferred 2.1 extraction.
5. **Subagent quota volatility** (bit us twice today): adversarial fleets run when quota
   allows; inline three-lens review is the documented fallback (as on PR #57).
6. **Content bandwidth (E):** the range library without owner-authored content is an empty
   shelf — Q3.3 UX only ships together with Q3.4's first content drop.
