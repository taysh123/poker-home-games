# T Poker — Full-Project Audit (capstone)

> **Scope:** a world-class-readiness audit of the whole stack on the **held** branch
> `feature/v2-poker-platform` (no merge, no deploy). Lenses: CTO · Staff Engineer · PM · UX Lead ·
> Security Architect · Growth Lead · Design Director. Read-only audit (Phase 0, 4 parallel domain
> reviews) → **verify each finding against source** → implement the **safe, non-blocked** subset →
> document the rest as a prioritized backlog. Standing guardrails held throughout: flags OFF ⇒ prod
> byte-identical, no concrete solver adapter, no assumed redistribution rights, no fabricated
> solver/AI/legal data.
>
> **Date:** 2026-06-24. **Audit commits this round:** `449231e` (frontend a11y/bugs) · `b92c809`
> (backend security) · `4623a8c` (solver hardening) · `38b9305` (AI cost/abuse). **Gates green:**
> tsc · 427 jest / 51 suites · expo export -p web · dotnet build · 126 backend tests.

---

## Executive summary (CTO view)

The codebase is **disciplined and honest**. Clean-Architecture boundaries hold (Domain imports nothing
outer; Application depends only on interfaces), the "flags OFF = byte-identical prod" guarantee is real
(all 17 V2 flags `false` in `PROD_FLAGS`; beta/dev overrides unreachable in prod), and the commercial
foundations (billing, AI, solver) are built **dormant, mock-default, and fail-closed** — nothing can
charge a card, grant premium on error, or present fabricated solver numbers as authoritative.

The gaps that separate "solid" from "world-class + commercially launchable" are **not** architectural
quality. They are: (1) the product is **not measurable** in production (analytics is instrumented but the
sink is a no-op); (2) the headline "training product" value (verified solver data, live AI) is
**externally blocked** (vendor rights, billing accounts, counsel); and (3) a tail of **safe, additive
correctness/security/a11y fixes** — most of which this round implemented and the rest are backlogged
below with file refs and a safe-now-vs-blocked tag.

**Verdict:** technically launch-capable as a **live home-game + tournament manager** today (the honest
wedge). The "GTO trainer" positioning and paid tiers are gated on external unblocks, not on engineering
debt.

---

## What this round fixed (verified + committed)

| Area | Fix | Files | Commit |
|------|-----|-------|--------|
| a11y | `AnimatedNumber` snaps to final value under OS Reduce Motion | `components/motion/AnimatedNumber.tsx` | `449231e` |
| bug | Home entrance fade was re-firing on **every** tab focus (once-per-mount guard was scoped behind the OFF `polish` flag) | `screens/HomeScreen.tsx` | `449231e` |
| a11y | `Toast` now announces to screen readers (`announceForAccessibility` + live region + `role=alert`) — container is `pointerEvents:none` so AT never reached it | `components/Toast.tsx` | `449231e` |
| a11y | `ActionSheet` `accessibilityViewIsModal` + roles/labels; icon-only buttons (AllSessions/GroupsList/LocalSession) labeled | `components/ActionSheet.tsx`, 3 screens | `449231e` |
| bug | `DealInOverlay` gold-sweep `Animated.loop` leaked (only the timeout was cleared) | `components/DealInOverlay.tsx` | `449231e` |
| security | **ChangePassword now revokes all active refresh tokens** — a compromised account previously stayed reachable for 30 days post-change | `…/ChangePassword/ChangePasswordCommandHandler.cs` | `b92c809` |
| security | `CurrentUserService.UserId` **fails closed** (throws) instead of collapsing a missing claim to `Guid.Empty` | `Infrastructure/Services/CurrentUserService.cs` | `b92c809` |
| security | CSV export hardened against **spreadsheet formula injection** (`=,+,-,@`) + RFC-4180 quoting, via testable `CsvSafe` helper | `Application/Common/CsvSafe.cs`, `SessionsController.cs` | `b92c809` |
| bug | Solver workspace **Rules-of-Hooks crash** (a `useCallback` sat after an early return) | `features/solver/ui/SolverWorkspaceScreen.tsx` | `4623a8c` |
| robustness | `validatePack` now checks **freq-sum ≈ 1** and **valid 169-grid hand keys** (after the hash check, so it can't mask a tamper) | `features/solver/pack/validate.ts` | `4623a8c` |
| security/cost | `AnalyzeHand` inputs **length-bounded** (token-bomb/injection + the 200-char IdempotencyKey column); AI HttpClient gets a **30s timeout + 2 MB cap** | `…/Coach/Commands/AnalyzeHandCommand.cs`, `Infrastructure/DependencyInjection.cs` | `38b9305` |

New regression tests added: `ChangePasswordTests`, `CsvSafeTests`, `AnalyzeHandValidatorTests`, +2 pack
validator tests (`+11` tests total; 415→427 jest counted with 2 new pack tests, 113→126 backend).

## Findings verified FALSE / dismissed (do not act)

The audit subagents surfaced several "critical" items that **did not hold up against source** — recorded
so they aren't re-raised:

- **"CRITICAL: prod flag leak — Study/Coach/LogSession screens registered unconditionally."** FALSE.
  `AppNavigator` registers them as non-deep-linkable destinations with no UI affordance when their parent
  tabs are flag-gated off; the only `linking.config` entry (`SolverWorkspace`) **is** flag-gated.
  `PROD_FLAGS` are all `false`. Prod stays byte-identical.
- **"Missing `IX_BuyIns_SessionPlayerId` / `IX_CashOuts_SessionPlayerId` on hot paths."** FALSE. Both
  exist in the current model snapshot (`AppDbContextModelSnapshot.cs:263,303`), created by EF's FK-index
  convention in the `AddGuestPlayers` migration. No migration needed.
- **"ActionSheet option touch target ~34px."** FALSE — `paddingVertical:17`×2 + 16px line ≈ 50px (> 44).
- **"`StatWidget` animates on every render."** FALSE — effect deps are `[]` (once per mount). (Real gap:
  missing reduce-motion guard — backlogged.)
- **"Coach server orchestration (reserve→refund-on-failure) untested."** FALSE — covered by
  `B2EnforcementTests` (`ProviderFailure_RefundsCredit`, quota path).
- **"No analytics system."** FALSE — three layers exist (live `track()`, vendor-neutral
  `analytics/contract+adapter`, workbook model). Real gap = the no-op `dispatch()` sink (below).

---

## 1) Critical issues

| # | Issue | Where | Status / action |
|---|-------|-------|-----------------|
| C1 | **Analytics `dispatch()` is a permanent no-op** — 30+ PII-free `track()` call sites, but nothing leaves the device. The product has **zero production telemetry**; funnel/retention/revenue are unmeasurable at launch. | `utils/analytics.ts` (+ unused `analytics/adapter.ts`) | **Safe-now (scaffold)** — wire one provider in `dispatch()` and route through the existing `adapter.ts` validation/PII-drop; call sites need no change. Live vendor keys = blocked. |
| C2 | **`CreditBalance` has no EF concurrency token** despite a code comment claiming "Postgres xmin" protection; double-spend safety rests solely on the Serializable tx (skipped on the non-relational test path). | `Domain/Entities/CreditBalance.cs`, `MonetizationConfigurations.cs` | **Safe-now** (add xmin rowversion + a concurrent-`TryConsume` test). Flag-gated dormant → not a *current* prod risk, but a **monetization-launch blocker**. |
| C3 | **First-grant `CreditBalance` insert + webhook duplicate delivery throw uncaught unique-violations** → 500 (and a store retry-storm) instead of idempotent no-op. | `Infrastructure/.../CreditLedger.cs` (EnsureBalance/Grant/Refund), `ProcessStoreNotificationCommand` | **Safe-now** (catch unique-violation, treat as already-applied). Dormant; **monetization-launch blocker**. |

> C2/C3 are critical **for the day monetization flips on**; today they are inert (mock billing default).
> They are tracked as launch blockers for the paid tier, not for the free app.

## 2) High-priority improvements (all safe-now unless noted)

| # | Issue | Where | Note |
|---|-------|-------|------|
| H1 | **AddPlayer IDOR**: any group member can add an *arbitrary* `userId` as a registered player; that user then passes the H2H/profile privacy guard, exposing their career stats to the group. | `AddPlayerCommandHandler.cs`, `GetPlayerProfileQueryHandler.cs` | Add a group-membership check on the added user (verify guest/standalone-session semantics first). Prod-active. |
| H2 | **`Settlement` (a money record) has no concurrency token** → concurrent "mark paid" both succeed (lost update). | `SettlementConfiguration.cs` | Add xmin/RowVersion + catch `DbUpdateConcurrencyException`. Needs migration. Prod-active. |
| H3 | **Coach `/api/coach/analyze` is not server-flag-gated** — the "coach OFF in prod" guarantee depends on clients not calling it. | `CoachController.cs` | Add a server-side feature gate (it already reserves+refunds + rate-limits; this closes the client-trust gap). |
| H4 | **`EntitlementService` picks the sub with the latest `CurrentPeriodEnd` then checks active** → a refunded/expired sub with a far-future period end can shadow a currently-active one (fail-closed, but under-grants a paying user). | `EntitlementService.cs` | Filter to active candidates in the query. Dormant. |
| H5 | **Reduce-Motion not yet universal** — `StatWidget` entrance, `LiveGameBar` infinite live-dot pulse, `AchievementUnlock` overlay still animate regardless of the OS setting. | `components/StatWidget.tsx`, `navigation/AppNavigator.tsx`, `components/AchievementUnlock.tsx` | Apply the `useReducedMotion` pattern already used in `Celebration`/`AnimatedNumber`/`HomeScreen`. Prod-active (StatWidget/LiveGameBar). |

## 3) Medium-priority improvements

| # | Issue | Where | Note |
|---|-------|-------|------|
| M1 | Coach rate limiter is a **single global fixed window** (12/min app-wide), not per-user → one abuser starves everyone. | `Program.cs` | Partition the limiter by the user claim. |
| M2 | `GroupInvitation` "prevent duplicate pending" index is **not unique**; `SessionInviteToken` has **no `SessionId` index**; no standalone `InvitedUserId` index. | `*InvitationConfiguration.cs`, `SessionInviteTokenConfiguration.cs` | Additive migrations (unique filtered index on Status=Pending; lookup indexes). |
| M3 | **Observability is thin** — `LoggingBehavior` logs only request type names; no userId/correlation/duration/outcome, no metrics/tracing. | `Application/.../LoggingBehavior.cs` | Enrich with userId + elapsed + success/failure (safe-now). OpenTelemetry exporter = blocked (infra). |
| M4 | Invite tokens use `Guid.NewGuid("N")`, **not a CSPRNG**, for 7-day group links + 24h session tokens. | `GroupInviteLink.cs`, `SessionInviteToken.cs` | Use `RandomNumberGenerator` + base64url (the pattern already in `JwtService`). |
| M5 | `FraudEvaluator` binds/scores accounts by a **client-supplied raw `DeviceId`** → a malicious client can poison the accounts-on-device signal. | `FraudEvaluator.cs` | HMAC the deviceId server-side (full trust needs attestation = blocked/deferred). |
| M6 | **Design tokens bypassed**: `HomeScreen`/`LocalSessionScreen` hardcode success/error rgba instead of `successFaint`/`errorFaint`; `Toast` hardcodes `#fff`. | `screens/HomeScreen.tsx`, `screens/LocalSessionScreen.tsx`, `components/Toast.tsx` | Token swap (the tokens already exist). Prod-visible (ledger). |
| M7 | CSV export **filename** is built from the user-controlled session name into Content-Disposition. | `SessionsController.cs` | Sanitize/encode (ASP.NET encodes, but normalize CR/LF defensively). |

## 4) Nice-to-have improvements

- **Doc drift** (safe-now): typography is **Sora** but `CLAUDE.md`/`src/CLAUDE.md` still say **Inter**;
  `data-safety.md` says BCrypt **work factor 12** but code is **13**; `safe-launch-readiness.md` /
  `v2-deployment-checklist.md` / `commercial-readiness.md` say **$79.99/save 44%** but code + Terms say
  **$99.99/save ~30%**. Reconcile (paywall OFF, so no live user-facing risk).
- **Log hygiene** (safe-now): `AnalyzeHand` audits the raw client IdempotencyKey into the audit sink —
  now length-bounded (this round), consider hashing before logging.
- **Solver/mastery test gaps** (safe-now): `savedSpotsStore` CRUD + the solverPackStore quarantine branch;
  `attemptStore` per-record shape validation; `conceptMastery([])`.
- **Grounding seam is honest + tested but unused** by the live prompt (`features/coach/logic/grounding.ts`)
  — wire it into AI Coach 2.0 (design doc forthcoming) or note it as reference-library-only.
- **Winner crown emoji** (`LocalSessionScreen`) vs the "no emoji as icons" rule — intentional flourish; low priority.

## 5) Launch blockers

| Blocker | Type | Notes |
|---------|------|-------|
| **Real solver data + redistribution rights** | EXTERNAL (vendor) | Needed for any "GTO trainer" claim. Canonical pack + import pipeline + flip checklist are ready; values absent + never fabricated. See `solver-vendor-evaluation.md`, `solver-flip-readiness-checklist.md`. |
| **Live billing** (RevenueCat mobile + Stripe web + webhooks) | EXTERNAL (accounts/keys) | The `paywall` flag MUST stay OFF until live, or a buy button grants nothing/errors. Verifiers are built + fail-closed. |
| **Real AI provider** (Anthropic key + server proxy) | EXTERNAL (key) | The 1-free-analysis hook is a strong lever but currently a labeled DEMO (mock). Seam built + fail-closed. |
| **Terms / Privacy finalization** | EXTERNAL (counsel) | Terms DRAFT is linked from the prod-visible Profile screen + the paywall; subscriptions can't be sold against a draft. |
| **Analytics sink (C1)** | INTERNAL, safe-now | Not a code blocker but a **business** blocker: launching blind (no funnel/retention/revenue signal). Wire before any growth spend. |
| **Credit-ledger concurrency/idempotency (C2/C3)** | INTERNAL, safe-now | Blockers **only if monetization flips on**; inert today. |

## 6) Post-launch roadmap (sequenced)

1. **Measure first** — wire `dispatch()` (C1) + instrument the legacy onboarding + `paywall_dismissed`
   (T2 below). Nothing else should ship to users before the funnel is observable.
2. **Ship the honest wedge** — position as the live **home-game + tournament manager** (no competitor owns
   the friend-group cash-game niche); **cloud sync** is the cheapest, most defensible **first real premium
   benefit** (already advertised in the paywall as "Soon").
3. **Unblock the trainer** — on a written redistribution answer, run the vendor-reply playbook → import a
   verified pack → flip `solver` (the inspector/tree already consume the canonical model honestly).
4. **AI Coach 2.0** — feed the grounding seam with canonical solver/range facts, then enable the real
   provider behind the server key.
5. **Retention loop ON** — streaks/daily-goal/XP/reminders are built behind `retention`/`study`/`reminders`
   (push needs an iOS EAS build).
6. **Scale hardening** — Redis distributed rate-limit (in-memory is per-instance), partition coach limiter
   (M1), concurrency tokens (C2/H2), OpenTelemetry (M3), SSR/SSG for solver-page SEO.

---

## T1 — Design Excellence Review (Design Director / UX Lead)

**Foundation: genuinely strong (App-Store-tier).** A cohesive Velvet-Table token system
(`theme/colors.ts`), a 3-face type ramp (DM Serif Display / Sora / Inter), Reanimated-4 motion primitives
(`components/motion/`), real "wow" beats (`Celebration` confetti, `DealInOverlay`), proper skeletons, and a
premium **live tournament dashboard**. This is not where T Poker is behind competitors.

**Where it's uneven (the world-class gap is consistency, not ceiling):**
- **Polish drops once you leave Home/Live.** Home and the live screens are flagship-grade; secondary
  screens (lists, profile, settings) are good-but-plainer. The highest-ROI design work is leveling the
  *floor*, not raising the ceiling.
- **Accessibility was the biggest premium-feel leak** — Reduce-Motion was ignored by count-ups/toasts/
  pulses, and icon-only controls were unlabeled. This round fixed the worst offenders (AnimatedNumber,
  Toast, ActionSheet, key icon buttons); H5 finishes the pass (StatWidget, LiveGameBar pulse).
- **Token discipline slips** in a few hot screens (M6) — hardcoded rgba where `successFaint`/`errorFaint`
  exist.

**Competitive comparison (vs GTO Wizard et al.):** T Poker's deficit vs GTO Wizard is **data, not design**
— GTO Wizard's moat is verified solver output, which is externally blocked here and honestly labeled
"illustrative" until real packs land. T Poker should **not** try to out-polish a solver it can't yet match
on data; its design advantage is the **live, social home-game experience** (clock, auto-settlement, recaps,
rivalries) that no trainer offers. Lead with that.

**Verdict:** visually competitive *today* for its actual category (home-game management); the trainer
surfaces are design-ready and waiting on data.

## T2 — Conversion & Growth Review (Growth Lead / PM)

**Honesty engineering is strong and must be preserved:** server-authoritative entitlements with a
fail-closed cache, `comingSoon` chips on every unshipped benefit, mock billing that never goes live by
default, honest pricing math ($99.99/yr = $8.33/mo, ~30% off $143.88). The gaps are **instrumentation and
commercial unblocks**, not deception.

**Safe-now, honest, high-leverage (do these — additive, flag-safe):**
- **G1 — Measure the funnel.** Add a `paywall_dismissed` event (only `paywall_viewed` fires today) and
  instrument the **legacy `OnboardingScreen`** (prod ships it; the funnel events only fire in the
  flag-gated `OnboardingV2`). Pair with C1 (wire `dispatch()`). Without this, activation + paywall
  drop-off are invisible. `features/premium/ui/PaywallScreen.tsx`, `screens/OnboardingScreen.tsx`.
- **G2 — Capture the strongest activation moment.** After a guest finishes their first local game (value
  just delivered, confetti firing), surface an honest "save this across devices" sign-up card on
  `LocalSessionSummaryScreen`. This is the highest-intent, currently-unused handoff and works on web today.
- **G3 — Positioning copy.** Lead store/landing copy with the live home-game wedge, not GTO parity.

**Blocked (don't fake around it):**
- Free→premium **conversion** needs ≥1 genuinely-live benefit (every paywall benefit is "Soon") + live
  billing — keep `paywall` OFF until then.
- The **1-free-AI-analysis** acquisition hook is real + server-enforced but currently returns DEMO output
  (mock provider) — needs the real key.
- The **retention loop** (streaks/daily-goal/XP/reminders) is built but dark in prod (flag-gated); reminders
  are native-only + need an iOS EAS build. The honest prod minimum today is the Home streak chip + weekly
  digest nudge.

**Monetization recommendation:** sequence **cloud sync** as the first paid benefit — defensible, cheap to
deliver, already advertised, and it monetizes the wedge rather than competing with GTO Wizard on solver
data.

---

## Method note

Every finding above was **verified against source** before being categorized; six subagent "criticals"
were dismissed as false (see the dismissed section). Items marked **safe-now** clear the safe bar (additive
/ provably-correct · no external dep · flags-OFF byte-identical or ledgered · testable · reversible) and
are eligible for implementation on this held branch; the round implemented the lowest-risk subset and left
the rest here so the eventual merge is a deliberate, reviewable release. Cross-references:
`docs/release/prod-visible-changes.md` (ledger), `docs/product/solver-*` (the blocked-on-vendor program),
`docs/release/*-readiness.md` (commercial gates).
