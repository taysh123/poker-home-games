# Q2 pillar grounding — brief vs. reality (2026-08-05)

Working notes feeding the Q2 master plan. Each pillar was explored against the CODE, not the
brief, specifically hunting for places where the 2026-07-27 product-quality master plan's Q2
block assumes something the codebase contradicts.

**Why this exists:** the 2026-07-27 brief was written before the 12-dimension audit completed.
Several of its slice sizes and owner decisions rest on assumptions the audit and this grounding
pass falsify. Building from the brief unchanged would ship wrong estimates and at least one
decision made on false premises.

**Status:** Wave A complete (bankroll+calendar, premium preview). Wave B pending (stats
dashboard, app tour). Checkpointed per-wave — quota has repeatedly killed this action.

---

## Pillar: Bankroll + Calendar (brief Q2.1 / Q2.2 / Q2.3)

### What exists today

100% client-side — `grep -rli bankroll src/ --include=*.cs` returns **nothing**. No backend
entity, endpoint, migration, or sync path. 11 files under `features/bankroll/` + 4 consumers.

- **Data** (`types.ts`, schema v1): `BankrollSession` with `gameType`/`source`/`currency`/
  `startedAt`/`venue`/`feesCents`/`notes`/`tags[]`/`cash?`/`tournament?`. `CashDetail` has
  `smallBlindCents?`/`bigBlindCents?`. **No `userId` field anywhere on a session.**
- **Logic** (`bankrollAnalytics.ts`, 311 lines): 10 exported functions —
  `sessionCostCents`, `sessionReturnCents`, `sessionNetCents`, `sessionDurationMinutes`,
  `isInTheMoney`, `filterSessions`, `summarize`, `bankrollOverTime`, `maxDrawdownCents`,
  `sessionNetHistogram`, `advancedStats`. **Zero date bucketing of any kind.**
- **Store**: one hardcoded key `tpoker.bankroll.v1`, quarantine-on-corrupt, identity migration stub.
- **UI**: `BankrollScreen` (hero P&L, 2 Segmented filters, line chart, PERFORMANCE tiles,
  **RISK & VARIANCE section fully built and free**, histogram, unpaginated history),
  `LogSessionScreen`, `BankrollLineChart` (the house SVG chart exemplar — onLayout width,
  `accessibilityRole="image"`, composed label, static render), `BankrollHistogram`.
- **Flags**: `PROD_FLAGS.bankroll = false`, `BETA_FLAGS.bankroll = true`, `DEV_OVERRIDES = true`.
- **Tests**: 2 suites / 32 tests, both green. No context test, no screen test, no honesty test.
- **Entitlements**: **absent entirely** — no `useEntitlements`, no `LockNudge`, no premium import
  anywhere in the bankroll tree. `premium/config.ts:90` declares `advanced_bankroll` /
  "Variance, filters & deeper trends" / `comingSoon: true`.

### Brief deltas (what the plan gets wrong)

| Brief claim | Reality | Impact |
|---|---|---|
| Q2.3: "Track tab leads with Bankroll" is work | Already done — `TrackScreen.tsx:39-48` puts bankroll first the instant the flag is true | **SMALLER** — zero code |
| Q2.1: filters "reuse existing BankrollFilter… date-range/tags get UI" | Accurate and stronger — all 6 filter fields exist and are pinned. **BUT** `filterSessions` string-compares `startedAt` (a noon-anchored UTC instant) against the raw `to` bound, so a bare day key silently excludes that whole day | **DIFFERENT** — the to-bound must be materialised as end-of-day ISO or the range is off-by-one |
| Q2.1: day/month bucketing is new foundational work | Month-P&L already exists **inline and duplicated** in `EngagementContext.tsx:92-100`; `localDayKey`/`localMonthKey` are pure and tested already | **SMALLER + DIFFERENT** — extract the duplicate, don't invent. Day buckets + heatmap bins are the only genuinely new pure functions |
| Q2.2: "stakes inputs (schema fields already exist)" | Schema claim TRUE, but **nothing reads them** — no analytics function references stakes, no bb/100 surface exists | **DIFFERENT** — shipping the inputs alone repeats the write-only-data defect class the audit just flagged for `rebuyCount` |
| Q2.2: "honest rebuy/add-on counts" | Confirmed at `LogSessionScreen.tsx:122-123`; also **no read site exists** anywhere, so the fix is ~30 min | **SMALLER as code**, but needs a decision on unrecoverable legacy beta rows |
| Q2.2: prefill "route param carries the game's numbers" | Route plumbing is one type edit. **But `LocalPlayer` is `{id, name}` — a local game has no notion of which seat is the logged-in user**, and the CTA renders for guests too | **BIGGER** — blocked on a product decision. Also: cloud sessions have no Log-to-Bankroll path at all |
| Q2.3 is an "S" (flag flip) | `LogSessionScreen.tsx:81` gates the native date picker on `isFeatureEnabled('polish')`, and **`PROD_FLAGS.polish = false`** → in a real prod build the date field degrades to a raw text input demanding typed `YYYY-MM-DD`. Every dev and beta tester has only ever seen the picker | **BIGGER** — a hard prerequisite the brief never names. Flipping `bankroll` alone ships a form nobody has tested |
| §4 decision: the premium split "takes nothing a free user has today (the screen was never live)" | **True for PROD, FALSE for BETA.** `BETA_FLAGS.bankroll = true` — every beta tester sees the full RISK & VARIANCE section free right now | **DIFFERENT** — the split IS a removal for the existing tester cohort. The owner decision was made on a false premise |
| Q2.3: put variance "behind an honest Coming-soon lock" | No lock machinery exists in this feature. `LockNudge` lives in `features/study/ui`, `triggers.ts` has no bankroll id (ad-hoc strings banned), and `tierHonesty.test.ts`'s phrase ban is a literal allow-list **scoped to `features/study/ui` only** — new bankroll copy would be covered by no test | **BIGGER** — a slice, not a line item |
| Q2.1/Q2.3 are "📸 screenshot-impacting" | **No bankroll shot exists.** The 10-shot set has no slot; Play caps at 8 and uses 01–08 in a study-first order. `store-shots.mjs` cannot change a compile-time flag, so no bankroll shot is capturable until the flag flips | **DIFFERENT** — means *displacing* an existing shot, and capture is strictly ordered after the flip |
| (audit) storage is unscoped | Confirmed **and worse**: `clearSession()` never touches AsyncStorage, and `TrackScreen.tsx:73` renders Bankroll **for guests with no auth gate**, so guest-logged sessions merge into whichever account signs in next. **No user-scoped-storage precedent exists in the repo** | **BIGGER** — a design slice with a first-of-its-kind pattern, must land before the flip |

### Slices (given reality)

| # | Slice | Days | Depends on | 📸 |
|---|---|---|---|---|
| S1 | User-scope the bankroll store + auth-change handling | 2 | none — **must precede any flag flip** | no |
| S2 | Pure calendar logic: day/month buckets, heatmap bins (+ extract the `EngagementContext` duplicate, fix the to-bound) | 1 | none (parallel to S1) | no |
| S3 | Month calendar view + monthly P&L strip | 2-3 | S2 | yes |
| S4 | Year heatmap | 1 | S2, S3 | yes |
| S5 | Date-range + tags filter UI | 1 | S2 | yes |
| S6 | Log-form honesty + prod-safe date input + stakes | 1-2 | none | becomes a candidate |
| S7 | Prefill Log-to-Bankroll from a finished local game | 1-2 | S6; **blocked on "which seat is me"** | no |
| S8 | Premium boundary: gate variance/histogram/deep filters | 2 | owner decision on beta removal | yes (removes tiles) |
| S9 | Flip the flag | 0.5 | S1, S6, S8 (ideally S3) | yes — unlocks capture |

### Open questions (owner)

1. **Beta removal** — testers see RISK & VARIANCE free today. Take it away, grandfather them, or
   keep it free permanently and rewrite the `advanced_bankroll` benefit copy instead?
2. **Local-game prefill** — ask which seat was yours each time, or persist a "this is me" marker
   on local games (schema v5)? Nothing prefills until this is decided.
3. **Storage scoping semantics** — on logout does bankroll disappear from the UI or stay? When a
   guest with logged sessions creates an account, do those sessions migrate in or stay device-local?
4. **Existing beta data has no owner attribution** — assign to the first user who signs in, keep
   as device/guest scope, or discard with notice?
5. **Date picker** — decouple from the prod-OFF `polish` flag (small, bankroll-scoped) or flip
   `polish` in prod (much larger blast radius)? Shipping neither means prod users type `YYYY-MM-DD`.
6. **Guest visibility** — should Bankroll stay visible to signed-out guests? This materially
   changes the storage-scoping design.
7. **Screenshot slots** — Play caps at 8 with a study-first order. Does a bankroll shot displace
   one of 01–08, or ride at 09/10 and be invisible on Play?
8. **Stakes inputs** — ship SB/BB write-only now (repeating the `rebuyCount` defect class), or
   hold until a bb/100 read surface exists?
9. **Legacy tournament rows** carry a fabricated 0-or-1 rebuy count that cannot be reconstructed.
   Leave them, or null them so no future feature reads a fake number as real?

---

## Pillar: Premium preview (brief Q2.7)

### What exists today

- **The flag-OFF preview is real but thin** (`PaywallScreen.tsx:113-153`, ~35 lines): BrandHeader
  + hero card + a `PREMIUM_FEATURES.map` of 4 rows each with a "Soon" chip. No pillar sections,
  no screenshots, no free-taste links, **no Terms/Privacy/support row** (those exist only in the
  paywall-ON branch).
- **Reachability is the real problem.** The route is registered in both trees, but in prod
  exactly **one** thing navigates to it: `ProfileScreen.tsx:441-451`, and ProfileScreen is
  **authed-only**. Guests — the entire free-first funnel — have zero path.
  - `LockNudge`'s "See Premium" button renders only when `paywallOn` → never in prod.
  - `LessonModulesScreen.tsx:87-91` locked rows get `onPress = undefined` in prod → **dead taps**.
  - `PackDetailScreen` flag-OFF branch is static text, no button.
  - `CloudSyncCard`'s `onGoPremium` is a **dead prop** (only fires inside `CloudSyncLive`, which
    never renders).
- **`TRIGGER_REGISTRY` exists, is complete, and is tested** (`triggerRegistry.ts`, 222 lines; 12
  ids; `isTriggerEligible`/`shouldShowNudge`/`recordNudgeShown`; persistence seam in
  `triggerNudgeStore.ts`). It has **zero production consumers** — a repo-wide grep outside the
  module and its tests returns nothing.
- **Pins are config-level only.** `honesty.test.ts` + `paywallContent.test.ts` assert
  `PREMIUM_FEATURES` shape. **No test renders PaywallScreen.** `legalSurfaces.test.ts:249-251` is
  a raw-text grep for `terms.html` against the file — it passes even though the flag-OFF branch
  renders no legal links at all.
- **Store screenshots** are submission artifacts only (1290×2796, 170–420 KB each, last
  regenerated 2026-07-23); nothing under `assets/` imports them.

### Brief deltas (what the plan gets wrong)

| Brief claim | Reality | Impact |
|---|---|---|
| "Rebuild the preview into a real product page" — a content/design upgrade | Content quality is **not the binding constraint; distribution is.** One authed-only entry point; guests can't reach it at all | **BIGGER + re-prioritised** — a beautiful page nobody can open is wasted. Reachability is a separate, cheaper slice that should land FIRST |
| "still ZERO purchase UI — pins intact" | The pins are config-level only; **no render-level test exists**. A rebuild could introduce a price, a CTA, or drop the legal row and nothing goes red | **DIFFERENT** — Q2.7 must ADD a render pin *before* rewriting, and fix `legalSurfaces.test.ts` from file-grep to branch assertion |
| "read copy from TRIGGER_REGISTRY (kills live copy drift)" — implies drift is a future risk | **Drift is already present**, and the registry's own header claims it "mirrors the current call-site copy" — false for **4 of 12** ids. `profile` vs `CloudSyncCard` share zero words; `lesson_locked` and `coach_teaser` copy render nowhere | **DIFFERENT** — not mechanical string-hoisting. 4 surfaces need a copy *decision*, and per rule 5 each decided string is a new claim needing its own pin |
| "ship the approved coach_teaser card" | `isTriggerEligible` returns `ctx.coachEnabled` for every coach-surface trigger, and `coach: false` in prod → **the card can never render**. The two brief items contradict each other | **BLOCKED** — needs a "teaser allowed while feature is dark" axis, or coach_teaser reclassified off the coach surface. A registry design decision, not a UI task |
| "per-pillar benefit sections with real screenshots" | Reusing store PNGs means ~1.5–2 MB of new bundled assets **and a permanent staleness contract** — a screenshot of a screen that later changes becomes a false claim (rule 3's exact failure mode) | **BIGGER, possibly wrong approach** — live component previews are cheaper, always accurate, already in the bundle |
| (implicit) the 4 `PREMIUM_FEATURES` are an accurate list | **Two are mislabelled in opposite directions.** `advanced_bankroll` is comingSoon:true but is **built, free, ungated**; `premium_study` is comingSoon:true but 28 modules ship bundled with 25 gated — "built, not purchasable" | **DIFFERENT** — "Coming soon" is doing duty for three distinct states. The which-lands-first section can't be written honestly until the owner labels each |
| "cooldowns actually consulted" | `shouldShowNudge` is pure and tested but has **no consumer seam**, and half the ids have `cooldownDays: 0` (a no-op by construction) | **SMALLER** for daily-limit surfaces, but adds a genuinely new async seam + persistence test for 5 ids |
| "type the route param, declare purchase_pending" — listed with the large items | Both trivial (<1h combined). The one real defect: `AppNavigator.tsx:530` mints `` `landing_${plan}` `` as a **template string** that happens to be valid today and would silently break under a rename | **SMALLER** — fold into the registry slice |
| (audit) entitlement bypass is an adjacent HIGH to "design around" | **Worse than audited.** `PremiumContext.tsx:48-59` loads the entitlement with **empty deps** and never reloads on auth change; `entitlementStore` persists **no userId and no timestamp** → a premium cache written under account A **survives logout into account B**. On web it's one devtools line. Also: the real blast radius is **25 of 28** locked modules (the audit's "22" counted the workbook column that `lessons.ts:41` explicitly overrides) | **MAKES THE FIX A PREREQUISITE**, and bigger than the audit's shape — needs a schema v1→v2 bump with `userId` + `cachedAt`, migration through quarantine, plus reload-on-auth-change |

### Slices (given reality)

| # | Slice | Days | Depends on | 📸 |
|---|---|---|---|---|
| Q2.7-0 | **PREREQUISITE** — entitlement trust hardening (schema v2 w/ userId+cachedAt, staleness+scope ceiling, LessonReader self-check, Landing guard, dev-only mock) | 2 | none — before any Q2.7 surface work | no |
| Q2.7-A | Preview reachability: real entry points + the missing render-level pin | 1.5 | Q2.7-0 (soft) | yes (lessons, study-home) |
| Q2.7-B | Registry wiring: one copy source, cooldown seam, typed route param | 2 | after A (migrate once, not twice) | yes if copy changes |
| Q2.7-C | The product page itself: pillar sections, honest labels, free-taste links, coach_teaser | 3 | A, B + owner decisions | new screen |
| Q2.7-D | Resolve the `advanced_bankroll`/`premium_study` labelling contradiction | 0.5 | owner decision; blocks C's which-lands-first | no |

### Open questions (owner)

1. **Should guests reach the premium preview at all?** They're the entire free-first funnel and
   currently cannot. But adding a premium upsell to the guest tree conflicts with the store
   README's "education first, nothing reads as a paid poker product" submission principle.
2. **`coach_teaser` is unshippable as specified** — add a "teaser allowed while feature is dark"
   eligibility axis, or move it off the coach surface?
3. **Is `advanced_bankroll` premium or free?** Fully built with zero gate. If free, the preview
   drops to 3 benefits; if premium, a gate must be retrofitted before the bankroll flag flips.
4. **Is `premium_study` honestly "coming soon"?** The honest sentence is "built, not purchasable
   yet" — do we say that plainly, and does it invite "why are you withholding finished content?"
5. **"Which lands first"** needs a committed, publishable order. Is there one, and is it firm?
   A published order that slips is a new honesty liability of exactly the tracked class.
6. **Real screenshots vs. live component previews** in the page (bundle cost + staleness contract
   vs. always-accurate and free)?
7. **Does the preview need the legal/support row** the paywall-ON branch has? (Grounding read:
   yes — it's a public commercial-claims surface either way, and `legalSurfaces.test.ts` already
   believes it's there.)

---

## What Wave A could not verify

Neither agent ran the app or viewed a rendered screen (static reading + one `npx jest
src/features/bankroll` run, 2 suites / 32 tests green). Not verified: `DateTimePicker` behaviour
on a real device; how a month-grid a11y tree reads under VoiceOver/TalkBack; EAS beta
distribution numbers (so the real blast radius of the storage leak and the variance removal is
unknown); the entitlement-poisoning repro was **not executed** (code trace only, same
evidentiary level as the audit); `store-shots.mjs` was not run; server-side
`GetEntitlementQueryHandler` was not read, so how often the cache path is actually taken in
practice is unknown.
