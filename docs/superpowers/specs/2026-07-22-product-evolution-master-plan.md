# Product Evolution Master Plan — "The Poker Player's Operating System"

- **Date:** 2026-07-22
- **Status:** Approved by owner (wave structure + decisions 1–8 below); execution begins with Wave 0
- **Relationship to prior specs:** builds ON TOP of the free-first split
  (`2026-07-18-free-first-split-design.md`) — its §5.6 ship invariants remain binding for every
  slice here. This plan supersedes nothing; it sequences the next product waves.
- **Provenance:** Phase-1 13-agent code audit (2026-07-21) + 4-lens adversarial critique of the
  draft plan (feasibility / honesty / sequencing / scope), findings incorporated throughout.

## 1. North Star & principles

Weekly Active Poker Players. Secondary: games created, groups created, daily practice runs,
retention, streaks, weekly active groups. Every slice must serve the before/during/after-session
loop. Feel: premium, simple, confident — never casino-like. Velvet Table design system; polish
(loading/empty/error/success, motion, a11y) is part of every slice's definition of done.

**Ship invariants (every merge):** nothing purchasable anywhere; AI Coach makes zero API calls;
all premium is "Coming soon"; guests keep the full free experience; honesty CI pins are extended,
never weakened; the store-launch track is never blocked; nothing irreversible depends on the
publisher entity (still provisional).

## 2. Owner decisions (locked)

1. **Engagement architecture — Hybrid:** client-first mechanics now; a thin server engagement
   core lands in Wave 3 (persona, XP, streak snapshot, free study backup) so leagues and
   cross-device state build on it without rework.
2. **Content — bundle the full free bank:** quiz_bank (1,460 approved questions, ~1.64 MB)
   ships in-binary. quiz_catalog is NOT bundled (no consumer; 949 KB dead weight — bundle it
   with whatever feature first consumes it).
3. **Analytics — PostHog EU**, wired to the existing typed seam.
4. **Store submission — submit now** (decision 1a): data-safety forms describe the current
   no-analytics build; forms are re-filed with the first Wave-0 update that ships analytics.
5. **Guest analytics — approved:** anonymous PostHog for guests, initialized only AFTER the
   explicit Welcome choice, WITH the scoped privacy.html rewrite (guest-data guarantees rescoped
   to game data; dead-Paddle content reconciled; legalSurfaces test pins updated deliberately).
6. **Free study backup — approved:** invisible study-progress backup for signed-in free users is
   NOT the premium "Cloud Sync" product. S7aCloudSyncTests is deliberately re-scoped: `study`
   namespace free; `localGames`/`coach` remain premium-403. New client path with its own flag —
   `cloudSyncService` and its comingSoon gate test are untouched.
7. **Coach teaser — approved:** an honest "AI Coach — coming soon" card in prod, flag
   `coachTeaser`, routing ONLY to the Paywall flag-OFF preview (never into the unconditionally
   registered Coach routes), zero API calls.
8. **Thin categories:** rotation ships without them; owner authors ~30–50 questions each for
   Hand Reading / Population Exploits / Tournament Strategy / Mental Game during Wave 1.

## 3. Wave 0 — Activate dormant assets (~1 week, 5 PRs)

### 0.1 Full question bank + daily rotation
- Bundle `quiz_bank.pack.json` (from `content/release-0.8.1/exports/0.8.1/packs/`, regenerated
  via `tools/content-export` if stale) into `assets/content/0.8.1/` + register in
  `bundledArtifacts.ts`/`bundledPacks.ts`. Its single hard FK (CalibrationProfileID →
  Calibration_Report) resolves against the already-bundled calibration_report pack (verified,
  0 dangling).
- **Remove quiz_sample in the same PR** — both packs map to table `quiz_bank` (tableNameFor
  derives from source_sheet): bundling both double-inserts.
- Date-seeded rotation: `selectQuestions` gains a deterministic seeded shuffle keyed on
  `localDayKey` — fresh questions daily, stable within a day, no repeat until the pool cycles.
  Pure + TDD.
- "Report question" action (typed analytics event; buffers until 0.2 wires dispatch).
- Web: measure in-memory ingest with the full bank; add a lazy-ingest guard if startup regresses.

### 0.2 Analytics live (PostHog EU)
- `dispatch()` → posthog-react-native, batched, flushed on background; `analytics` kill-switch
  flag (extend `features.test.ts` expectedOn in the same PR).
- **Consent model (decision 5):** SDK initializes only after the user's explicit Welcome choice;
  anonymous for guests; a real (unmocked-dispatch) CI test pins the pre-consent no-send
  guarantee.
- Privacy surfaces in the same PR: privacy.html guest-guarantee rescope + dead-Paddle
  reconciliation; `legalSurfaces.test.ts` pins updated deliberately; store data-safety re-filed
  with this update (decision 4).
- Typed **trigger-ID union** (moved forward from E.1) so LockNudge / locked-lesson / teaser
  impression events emit stable IDs from day one. Registry/eligibility/cooldowns stay in E.1.
- Baseline dashboards: entry funnel, daily quiz, practice, share.

### 0.3 Streak reminders ON
- **Disarm `free_ai` first** (critique blocker): remove or hard-gate the reminder kind on coach
  availability; add an honesty pin asserting no reminder copy promises unavailable features.
- Fix all THREE UTC todayKey escapees (`useReminderScheduler.ts:16`, `StudyScreen.tsx:29`,
  `NotificationPreferencesScreen.tsx:25`) + grep-ban `toISOString().slice(0, 10)` day keys.
- Flip `reminders` in PROD_FLAGS (+ flag-matrix test extension). Native-only; permission asked
  contextually after the first completed drill. Fixed 20:00 ships now; personalization in 3.1.

### 0.4 Monotonic XP
- Replace the `currentStreak × 5` term in `computeXp` with cumulative streak-days credit so XP
  never decreases. Prerequisite for visible XP emphasis and league math.

### 0.5 Docs reality + hygiene
- Rewrite stale CLAUDE.md sections (root + src/ + apps/poker-mobile/src/) against the audit;
  delete committed `out2/` build artifacts + gitignore.

### 0.6 Legal-pages reconciliation (PRE-SUBMISSION — owner-added 2026-07-22)
- terms.html / pricing.html / refund.html still name Paddle as the live web Merchant of Record
  (with $8.99/$79.99 web pricing), contradicting the 0.2-updated privacy.html ("nothing is
  currently purchasable; app stores when premium launches"). Store reviewers read these pages —
  reconcile BEFORE store submission: rewrite all three to the honest free-first posture,
  re-pin their `legalSurfaces.test.ts` blocks deliberately (same treatment privacy.html got).
- Ordering: must land before the store listing is submitted for review; independent of 0.3–0.5.

## 4. Wave 1 — A: Personalized onboarding (~2 weeks)

- **1.1 Quiz funnel** inside OnboardingV2's phase machine ('slides' | 'router' gains 'quiz'):
  outcome promise → goal (host / improver / both) → skill self-report → format (cash/MTT,
  live/online) → optional name. Progress bar starts pre-filled. ui-ux-pro-max leads; taste
  options (quiz-card vs chat-style) presented at slice time.
- **1.2 Persona capture:** `tpoker.persona.v1` scoped via `accountKeyFor`; per-step funnel
  events; skip preserved; server persona deferred to 3.2.
- **1.3 Personalized surfaces:** Home/GuestHome hero varies by goal; **quiz + placement
  difficulty** seeded from skill via `selectQuestions`' difficulty filter (trainer-engine
  difficulty is new capability — deferred to Wave 3); "retake quiz" row in Profile (fixes the
  one-way `hasSeenOnboarding`).
- **1.4 Placement drill (stretch):** 5 calibrated questions offered as the first post-onboarding
  action; skippable.
- **1.5 Definition of done:** store-shots.mjs harness repaired for the new flow + all committed
  screenshots regenerated (owner reviews).
- Owner (parallel): author the thin-category questions (decision 8).

## 5. Wave 2 — B: Viral loop + the pre-session moment (~3 weeks)

- **2.1 End-game extraction — three consumers, three PRs** (SessionScreen, LocalSessionScreen,
  LocalSessionSummaryScreen; the two Final Counts are divergent implementations — decimal+chips
  toggle vs integer cents — so this is unification behind an adapter):
  (a) local module + first end-game screen tests (existing @testing-library harness),
  (b) server adaptation, (c) summary-screen adoption. 2.2/2.4 depend on (c).
- **2.2 Results Card 2.0** (ui-ux-pro-max leads): one navy+gold branded card for all game types;
  all players; group branding; honors the currency util (kills hardcoded ₪); retires "PokerHome"
  PDF branding. Web: share text + link (server OG images deferred).
- **2.3 QR invites:** `react-native-qrcode-svg` (peer react-native-svg already shipped) on group
  + session invite sheets. Local games stay single-device.
- **2.4 The closed loop:** end-of-game funnel (Celebration → card preview → share →
  "Same crew next week?" creates a draft) **plus the pre-session moment**: "Next game" card on
  Home/GuestHome while a draft/scheduled game exists; local game-day notification scheduled at
  creation (no server infra); "Warm up: 10 hands before tonight" Study CTA on game day.
- **2.5 Weekly-crew surfacing:** extend the EXISTING "Your Week at the Club" digest card
  (top-movers row + leaderboard tap-through). No parallel weekly card.
- **E.1 Trigger registry:** central config (surface, copy, eligibility, cooldown) on the 0.2
  trigger-ID union; migrate LockNudge / locked lessons / profile teaser; new honest surfaces:
  3rd-free-lesson nudge, Track advanced-analytics teaser, `coachTeaser` card (decision 7);
  "trigger visible but nothing purchasable" honesty-test shape.

## 6. Wave 3 — C: Retention engine (~2–3 weeks)

- **3.1 Streak center:** ring + freeze-token visibility + streak calendar on Home/Study;
  reminder time personalization (median study hour from dailyCounts).
- **3.2 Server engagement core** (hard prerequisite for 3.4's XP layer):
  (a) shared UserIdentityDto FIRST (ends the 5-positional-auth-record fan-out);
  (b) User: Persona, XpTotal, StreakSnapshot(+asOf);
  (c) free study backup per decision 6 — NEW client path + own flag; per-namespace policy in
  `SyncContract`; S7a re-scope (study free, others premium-403); honesty test pins that
  localGames sync stays premium while cloud_sync stays comingSoon;
  (d) client accrues **per-ISO-week XP buckets** (what leagues consume — a lifetime scalar
  cannot be week-bucketed retroactively);
  (e) studyStore counter-union merge core (per-day max, set-union; pure, TDD);
  (f) guest→account claim on first sign-in;
  (g) privacy.html account-data enumeration + data-safety refresh in the same PR.
- **3.3 (shrunk):** surface the existing RankBadge/XP on the Study tab (already live on
  Home/Profile with rank-up celebrations — days, not a slice).
- **3.4 Weekly group leagues v1:** sessions-only standings via the EXISTING
  `?period=week` leaderboard endpoint + league framing/UI; XP overlay only after 3.2's weekly
  buckets sync; no persisted snapshot table in v1; push nudges deferred until job infra exists.

## 7. F — Localization infrastructure (interleaved after Wave 1; never store-blocking)

react-i18next + expo-localization scaffolding; en catalog extraction for entry/Study/Home;
pseudo-locale check for new code; ESLint nudge toward logical start/end props; additive backend
TypeKey+params on new notification emissions (old rows untouched); currencyPrefs stays OFF
(results card honors the currency util from 2.2). Full RTL sweep and Hebrew waves are separate
post-infra projects per `docs/release/localization-plan.md`.

## 8. G — Landing/SEO (plan-only)

One doc, execution deferred until core waves reach beta: 3 intent pages
(settle-a-poker-home-game, poker-debt-calculator with embedded settlement calculator,
blind-timer-guide), sitemap/blog routing, hreflang plan for future Hebrew.

## 9. Cross-cutting rules

- Every slice: feature branch → small PR → TDD → CI green (honesty pins extended, never
  weakened) → owner review → merge.
- ui-ux-pro-max leads visual slices with taste options; superpowers:writing-plans for any slice
  that grows beyond a small PR; verification-before-completion gates before every "done".
- Store parallel track: submission proceeds on current main (decision 4); only Wave 1 touches
  onboarding (screenshot regen scheduled); nothing touches eas.json; nothing depends on
  publisher identity.
- North Star instrumentation from 0.2: WAPP proxy, funnel completion, daily-quiz DAU,
  share-card sends, invite joins, D7 streak survival.

## 10. Risks

1. 2.1 unification (money-critical, divergent models) — three small PRs, tests-first, settlement
   fixtures already pin the math.
2. Full-bank web ingest cost — measured in 0.1; lazy-ingest fallback.
3. 0.2 privacy/consent execution touches pinned legal surfaces — deliberate test updates,
   decision 5 recorded.
4. Store re-review after Wave 1's onboarding change — routine update; education-first framing
   unchanged; screenshots regenerated.
5. Single-author content + higher exposure via rotation — "report question" action from 0.1;
   owner authoring pass (decision 8).
6. League on-read cost — v1 rides the existing bounded leaderboard query.
