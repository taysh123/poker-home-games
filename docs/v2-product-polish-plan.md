# T Poker V2.1 — Product Polish & Launch Preparation Plan

**Phase:** V2 Product Polish & Launch Preparation (doc 2 of 2) · **Branch:** `feature/v2-poker-platform` (no PR, nothing merged) · **Date:** 2026-06-20
**Companion:** `docs/v2-ux-audit.md` (findings this plan resolves).
**Status:** design + roadmap only — **no implementation yet**. Grounded in existing primitives (`Celebration`, `AchievementUnlock`, streaks, `usePushNotifications`, `EntitlementsContext`, feature flags, `RangeDataset`/`isIllustrative` seam) so most of this is wiring + content, not new infra.

**North star:** turn a well-built toolset into a **daily habit with a clear paid upgrade**. Every change serves one of three loops: **Activation** (first session value), **Retention** (daily re-entry), **Monetization** (free→premium).

---

## A. V2.1 Polish roadmap (prioritized, sequenced)

Workstreams ordered by impact-per-effort. Each is independently shippable behind flags.

### P0 — Launch-critical (before GA / paywall ON)
1. **Navigation IA → 5 tabs** (§F). The single biggest structural fix; everything else slots into the chosen IA.
2. **Onboarding redesign + account-creation moment** (§B). Activation loop.
3. **Premium conversion funnel** (§C): contextual triggers + soft paywall + plan transparency + (optional) trial.
4. **One engagement re-entry loop** (§D): streak + study + free-credit reminders via the existing push pipeline.
5. **Accessibility pass:** `accessibilityLabel` on all icon-only controls; contrast fix for `textDim`; reduced-motion guard on `Celebration`/entrance.

### P1 — High-value polish
6. **Error + offline states**: a shared `<OfflineBanner>` + `<ErrorState retry>` (mirror `EmptyState`); wire into Home/Bankroll/Study/Coach.
7. **Coach screenshot**: hide behind a sub-flag until real upload exists (don't ship a placeholder), OR implement image upload → server vision analysis.
8. **Study Decision Trainer**: build real continuous drilling (position/scenario filter + running session stats + end summary) OR merge into Spot Trainer.
9. **Bankroll log polish**: native date picker, tag trimming, write-failure toast.
10. **Achievements expansion + surface** (§D): more catalog entries + an Achievements screen + post-game `AchievementUnlock`.

### P2 — Engagement depth & content
11. **Progression system** (§D): XP/rank/levels + profile flair.
12. **Cross-pillar loops** (§D): post-game → "analyze a hand" / "log to bankroll"; post-analysis → "drill this spot."
13. **Content architecture v1** (§E): GTO packs + quizzes + training plans data model + entitlement gating + first premium pack.
14. **Paywall/chart polish**: price transparency, restore loading, chart tap-to-inspect, focus-once entrance animations, splash shortening.

### Defer to V2.2 / V3
- Real solver-data import pipeline + creator tooling; cloud sync for local features; web httpOnly-cookie auth + CSP; ML fraud signals; localization; tablet-optimized layouts.

---

## B. Onboarding flow design (Activation)

**Goal:** in <90 seconds, the user (a) understands the 4 pillars, (b) takes one real action ("aha"), and (c) is invited to create an account at the moment value is obvious — not before.

**Principle:** *value first, account at the value moment.* Don't gate the first action behind signup (guest-first is already the architecture). But make account creation the natural next step after the user sees their first result.

### Flow

```
Cold start
  └─ BrandSplash (shorten to ~1.8s after first run)
       └─ [First run only] Onboarding carousel (4 slides, pillar-led)
            └─ "Pick your starting point" (3 choice cards)  ← the aha router
                 ├─ "Track a game"   → start a local game (existing Play flow)
                 ├─ "Study a spot"   → one guided Spot Trainer hand
                 └─ "Analyze a hand" → one free AI analysis (the lifetime credit)
                      └─ Result shown → CONTEXTUAL account-creation sheet
                           "Save this + unlock groups, cloud stats & history"
                                 ├─ Continue with Apple / Google (1-tap)
                                 └─ "Maybe later" → guest Home (upsell persists)
```

### Slides (4, pillar-led — replaces the generic 3)
1. **Play** — "Run the night." *Buy-ins, cash-outs, tournaments with a blind clock — settle up in one tap.* (icon: `play-circle`)
2. **Track** — "Know your bankroll." *Every session, ROI, ABI, ITM — your real numbers, not vibes.* (icon: `wallet`)
3. **Study** — "Sharpen preflop." *Daily spot drills, streaks, and a growing range library.* (icon: `school`)
4. **Improve** — "Get an AI read." *Paste a hand, get structured coaching — your first analysis is on us.* (icon: `sparkles`)

Footer: **Get Started** (primary). Skip → straight to the choice router (never lose the aha).

### Account-creation moment (the conversion of activation)
- Triggered **after the first produced artifact** (a finished game, a completed drill set, or one AI result).
- Bottom sheet, single primary CTA stack: **Continue with Apple**, **Continue with Google** (verified-identity-only per B1; no email signup). Secondary: "Maybe later."
- Copy ties to what they just did: *"Save your analysis and pick up on any device — plus groups, leaderboards, and lifetime stats."*
- If declined: persistent (non-nagging) "Make it official" card already on guest Home (exists) + re-offer after the 2nd artifact.

### Pillar micro-intros (first entry into each tab)
First time a user opens Bankroll / Study / Coach, show a one-card coach-mark (not a blocking modal):
- **Bankroll:** "Log sessions you play anywhere — even outside the app — to see your true ROI." → "Log a session."
- **Study:** "Drill a spot a day to build a streak. 5 minutes beats an hour once a month." → "Train a spot."
- **Coach:** "Describe a hand or paste a history. You'll get mistakes, better lines, and tips — not a solver dump." → "Analyze a hand."

**Reused primitives:** existing `OnboardingScreen` (extend slides + add router), `BrandSplash` (shorten), Apple/Google auth (exists), `EntitlementsContext` (free lifetime credit already enforced server-side), a small `hasSeenPillarIntro.{pillar}` flag in storage.

---

## C. Premium conversion funnel (Monetization)

**Goal:** convert the free user at the **moment of demonstrated value**, with honest pricing and a low-friction path. Pricing fixed: **$11.99/mo · $79.99/yr (save 44%)**; free = 1 lifetime AI analysis; premium = 30 analyses/mo.

### Funnel stages & triggers

| Stage | Trigger (contextual) | Surface | Copy / CTA |
|------|----------------------|---------|------------|
| **Seed** | After the **first free analysis result** | Inline banner on `CoachResult` | "That was your free analysis. Premium = 30/month + advanced study." → *See Premium* |
| **Soft wall** | User taps a premium-only thing (2nd analysis, advanced bankroll filter, locked GTO pack) | **Soft paywall sheet** (not a hard block) | Shows the value they're reaching for + 1-tap upgrade; "Maybe later" allowed |
| **Milestone** | Streak hits 7 / a "you'd have unlocked" moment / strong week digest | Toast → paywall | "7-day streak 🔥 Unlock premium study plans." |
| **Hard wall** | `no_credits` from server (already mapped) | `Paywall` (existing) | "You're out of analyses. Go Premium for 30/month." |
| **Top-up** (B5) | Premium user low on monthly credits | Inline on Coach | "Out for the month? Add a 10-pack." (uses `RedeemTopUp`, gated until billing live) |

### Paywall screen improvements (`PaywallScreen`)
- **Show both plan prices + savings up front** (don't hide the unselected plan). Default-select **Annual** with the savings delta visible.
- **Value stack** directly above the CTA (3 bullets max): "30 AI analyses / mo · Advanced bankroll & study · Cloud sync."
- **Free-trial (optional, recommended):** 7-day trial on annual — store-managed introductory offer; raises conversion materially. Decide with billing setup.
- **Restore:** add a loading state; add a "Purchase help" link → support.
- **Social proof / reassurance:** "Cancel anytime in your store account." (already present) + a one-line trust note.
- Keep the single primary CTA (`primary-action`) ✅.

### Entitlement-aware surfacing
- Drive every premium CTA off `useEntitlements().isPremium` (server truth, B4) so premium users never see upsells and downgrades reflect instantly.
- All triggers respect the `paywall` flag (off until billing verified).

### Measurement (wire before GA)
- Funnel events into the existing `IAuditLog`/analytics seam: `paywall_viewed{trigger}`, `plan_selected`, `purchase_started/succeeded/failed`, `restore`, `trial_started`. Without these you can't tune conversion.

---

## D. Daily engagement systems (Retention)

The app has the *parts* (streaks, achievements, `Celebration`, `AchievementUnlock`, push). V2.1 connects them into a loop: **trigger → action → reward → progress → reminder**.

### D1. Streaks (Study already has the model)
- Keep Study's day-based `currentStreak`/`longestStreak`. Add a **streak-freeze** (1 free "skip day" per week, premium gets 2) so a single missed day doesn't nuke momentum — the #1 streak-retention lever.
- Surface the streak on **Home** (not just Study) and in the account-creation pitch ("don't lose your 5-day streak — save it to your account").

### D2. Study goals
- Make the **daily goal editable** (3 / 5 / 10 spots) from Study. Default 5 (current 10 is steep for a daily habit).
- Weekly goal layer (e.g., "drill 4 of 7 days") with a small weekly recap card.

### D3. Reminders (the missing re-entry loop) — uses existing push pipeline
Local + push notifications, all user-toggleable (Settings), respecting platform permission:
- **Streak risk:** evening nudge if today's goal isn't met and a streak is alive — "🔥 5-day streak — drill one spot before midnight."
- **Daily study:** opt-in time-of-day reminder.
- **Free analysis:** for free users who haven't used their lifetime credit — "Your free AI analysis is waiting."
- **Win-back:** lapsed 7/30 days — "Your crew misses you" / "New study packs added."
- **Implementation:** schedule via `expo-notifications` (local scheduled) for streak/study; server push (`ExpoPushService`, exists) for win-back + content drops. Add a Notification Preferences screen.

### D4. Achievements (expand + surface)
- Catalog exists (14, server-seeded, rarity tiers). Add pillar achievements: first bankroll session, 7/30-day study streak, first AI analysis, "logged 10 sessions," "100 spots drilled," "positive month."
- **Dedicated Achievements screen** (currently only on Stats); show locked (silhouette) + unlocked with rarity tint; progress bars on countable ones.
- Fire `AchievementUnlock` (exists) at the moment earned (post-game, post-drill, post-analysis) with `Celebration`.

### D5. Progression (new, lightweight)
- **XP + Rank**: small XP for meaningful actions (finish a game, drill set, analysis, log a session). Ranks themed to poker (e.g., *Rounder → Reg → Crusher → Shark → Legend*). Purely cosmetic + profile flair; no pay-to-win.
- Surface rank on Profile + Home greeting; rank-up uses `Celebration`.
- Keep server-authoritative (extend the stats/achievement tables) so it can't be farmed offline.

### D6. Cross-pillar loops (make pillars feed each other)
- **Post-game (Play→Improve/Track):** session summary → "Analyze your toughest hand" (Coach) + "Add to bankroll" (Track, pre-filled).
- **Post-analysis (Improve→Study):** result → "Drill this spot type" (Study, filtered).
- **Post-drill (Study→Improve):** strong session → "Try a real hand with AI."
- These convert single-feature users into multi-feature (higher retention + more upgrade surface).

---

## E. Future content architecture (Depth + premium value)

The premium tier needs **recurring content**, not just AI credits. The `RangeDataset` + `isIllustrative` seam and `EntitlementsContext` already point the way. Design a **content layer** that is data-driven, versioned, entitlement-gated, and server-delivered (so new content ships without an app release).

### Content types
| Type | What | Free vs Premium | Built on |
|------|------|-----------------|----------|
| **GTO Packs** | Curated `RangeDataset`s (cash 6-max, MTT, HU, ICM) with `isIllustrative=false` once verified | 1 starter free; rest premium | extends existing `RangeDataset`/`PreflopRange`/`HandStrategy` |
| **Quizzes** | Themed spot sets ("BTN vs BB defense," "3-bet pots") with scoring + pass/fail | Sampler free; full premium | extends `Spot`/`evaluateSpot` trainer engine |
| **Training Plans** | Multi-day structured curricula ("7-day preflop bootcamp") that schedule daily quizzes + track completion | premium | new `TrainingPlan` model + Study progress |
| **Premium Learning Modules** | Short lesson + drill + summary (concept → practice → mastery), optionally with an AI-coach tie-in | premium | lessons (markdown/structured) + trainer + Coach |

### Architecture direction
- **Server-delivered catalog**: `GET /api/content/catalog` → list of packs/quizzes/plans with `{id, type, title, tier, version, isIllustrative}`; **entitlement-gated** download (premium content returns metadata to free users for upsell, content only to entitled users — fail-closed, mirrors monetization).
- **Local cache + versioning**: reuse the versioned-store + quarantine pattern; content cached by `id@version`; the bundled starter stays as offline fallback.
- **Authoring/verification**: an internal pipeline to promote `isIllustrative=true` (training) → `false` (verified solver data); keep the honesty flag in the UI.
- **Gating**: one `useEntitlements()` check at the content boundary; locked items show a premium lock + upsell (feeds §C funnel).
- **Progression tie-in**: completing packs/plans grants XP + achievements (§D), closing the loop.

### Content roadmap
- **V2.1:** catalog endpoint + 1 free starter pack + 1 premium pack + quiz scoring; gate behind `study` + `paywall` flags.
- **V2.2:** training plans + lesson modules; AI-coach-linked drills.
- **V3:** creator/import tooling; community packs; localized content.

---

## F. Navigation IA proposal (resolves audit #1)

Cap the bottom bar at **5**. Recommended top-level (verified labels/icons exist):

```
[ Home ]   [ Track ]   [ Study ]   [ Coach ]   [ Groups ]
 home       wallet      school      sparkles    people
```
- **Home** = dashboard (P&L hero, active game, quick actions, activity) — Play lives here (Start Game / Tournament CTAs already on Home).
- **Track** = a hub combining **Bankroll + Sessions + Stats** (tabs/segments within one screen) — collapses 3 current tabs into 1.
- **Study** / **Coach** = the two Improve pillars (premium-forward).
- **Groups** = social (auth-gated for guests, as today).
- **Profile** moves to the Home header avatar (already the pattern) — not a tab.
- Guest tree mirrors this (Groups → sign-in gate). Pillars still flag-gated, but **introduced** (§B) when they light up.

*Alternative if Track-hub is too big a refactor for V2.1:* Home / Sessions / Study / Coach / Profile, with Bankroll + Stats reachable from Home cards. Pick one before flags flip.

---

## G. Sequencing, dependencies & exit criteria

**Dependencies:**
- §C funnel + §E content gating depend on the **billing go-live** (architecture phase) — build the surfaces now behind `paywall`, activate when billing is verified.
- §B account moment depends only on existing auth (ready now).
- §D reminders depend on `expo-notifications` permission + the existing push service (ready now).
- §F nav should land **first** (everything renders inside it).

**Suggested order:** F (nav) → B (onboarding) → D3/D1 (reminders + streak freeze) → C (funnel surfaces) → P1 fixes (states, screenshot, decision-trainer, bankroll, a11y) → D4/D5 (achievements/progression) → E (content) → P2 polish.

**Exit criteria for the polish phase:**
- ≤5 tabs; every pillar has a first-run intro.
- Onboarding ends in a real action + a contextual account offer; activation measurable.
- Paywall reachable from ≥3 contextual triggers; both prices visible; funnel events logged.
- At least one scheduled re-entry notification live (opt-in) + streak freeze.
- Zero placeholder features visible to users (screenshot + decision-trainer resolved).
- Accessibility: labels on icon-only controls, contrast pass, reduced-motion guard.
- `npx tsc --noEmit` + `npx jest` green; new UI has at least smoke/interaction tests where logic is non-trivial.

---

### Bottom line
The craft is already here. V2.1 is about **connecting** what exists — pillars into an onboarding story, value into a conversion funnel, streaks/achievements into a daily loop, and a content layer that makes premium worth renewing. Most of it is wiring + content + IA, not new architecture. **No implementation in this phase** — this is the audit + roadmap for review; on approval we sequence per §A starting with navigation.
