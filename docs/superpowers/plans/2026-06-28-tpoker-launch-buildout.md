# T Poker — Pre-Launch Full Build & Design Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development + dispatching-parallel-agents. Each slice = a fresh subagent; controller reviews (spec + quality) and independently verifies gates after each. ui-ux-pro-max on every UI slice (priority chain: a11y → touch → perf → style → layout → typography → animation).

**Goal:** Ship a fully-built, fully-designed T Poker with all four premium features live, a coherent app-wide design system, polished native mobile feel, and an upgraded landing — nothing left "Coming soon" except the (in-review) mobile store apps.

**Architecture:** One Expo (iOS/Android/Web, React-Native-Web) app in `apps/poker-mobile` + .NET 8 Clean-Architecture/CQRS backend in `src/` + standalone Next.js landing in `apps/landing`. Build on `feature/launch-buildout` (off the `feature/launch-phase-1-2` tip). Foundation-first: a locked design system, then parallel file-disjoint screen/feature workstreams, then cross-cutting integration.

**Tech Stack:** Reanimated 4 + **Moti** + **Lottie** (motion) · react-native-svg (charts, added in S8) · ui-ux-pro-max design system · Paddle billing (already integrated) · Claude Haiku via existing server-authoritative coach pipeline (activation deferred).

**Locked decisions:** Cloud Sync = backup & cross-device restore · Animation = Reanimated + Moti + Lottie · Design = refine & systematize Velvet Table · Branch = checkpoint-merge phase-1-2 (PR #3, user merges), then this branch.

**Standing constraints (user-confirmed):**
- AI Coach stays **mock + flags OFF the entire build**. No real Anthropic key, no prod flag flip — activation is a separate step needing the user's OK + their Railway env action. Build = audit + TDD-harden only.
- Honesty flip (S9) is held until the 3 features actually ship (Wave C ordering). Nothing advertised before it's real. Store badges stay "Coming soon"; content stays "Expert-Calibrated".
- Lottie assets AND the T Poker logo/brand mark must be shown to the user for approval **before** they ship.
- Check in at wave boundaries (after S1, end of Wave A) with screenshots. Flag Cloud Sync for extra review.
- Git Safety: no force-push/reset --hard/rebase/amend/branch -D/checkout --./clean -fd; nothing merged without user review; BOM-free English commits.
- Gates green after each slice: `tsc` · `jest` · `vitest` · `expo export -p web` · `dotnet build`/`test` (backend) · `next build`/`next lint` (landing) · **axe 0 violations** (UI) + controller Playwright verification.

---

## 1. Branch & merge strategy
1. Checkpoint `feature/launch-phase-1-2` → **PR #3 to main** (opened; user reviews + merges; not self-merged).
2. `feature/launch-buildout` off the phase-1-2 tip — all new work here.
3. When PR #3 merges, merge main back into `launch-buildout`.
4. `launch-buildout` → PR → user review → merge.

## 2. Design direction — "Velvet Table, systematized"
Keep identity (navy `#0F1923` + restrained gold `#C9A84C`; DM Serif + Inter/Sora). Rigor over reinvention. ui-ux-pro-max priority chain in order on every screen: **a11y → touch → perf → style → layout → typography → animation**. Foundation additions: `zIndex` scale (base/elevated/overlay/modal/toast), `iconSize` scale, blur tokens; primitives `Modal`/`BottomSheet`/`Skeleton`/`ProgressBar`/`Segmented`; reduced-motion completed (Celebration/Shimmer/table). Then migrate ~20 legacy screens. AA contrast (axe 0) is a per-slice gate.

## 3. Skills
superpowers: brainstorming → writing-plans → subagent-driven-development + dispatching-parallel-agents → test-driven-development (coach safety + cloud-sync merge) → requesting-code-review + verification-before-completion → using-git-worktrees + finishing-a-development-branch → systematic-debugging. ui-ux-pro-max (+ design-system, brand, ui-styling/design). vercel (nextjs, react-best-practices, vercel-cli/deployments-cicd) for the landing.

## 4. Subagent breakdown + dependency waves
**Wave 0 (sequential):** S0 controller (checkpoint PR + branch + Moti/Lottie install + plan commit); **S1 Design-system foundation** (LOCK).
**Wave A (parallel after S1, file-disjoint):** S2 Cash+Tournament · S3 Settlements+History+Leaderboard/Groups · S4 Premium Study+Paywall · S5 Auth+Settings+shared states+onboarding · S6 AI Coach (audit+TDD+UI) · S11 Landing polish (chip+brand SVG+animation; screenshots deferred).
**Wave B (after A; EF migrations serialized):** S7 Cloud Sync → S8 Advanced Bankroll Analytics.
**Wave C (cross-cutting, after features live):** S9 Honesty flip · S10 Mobile polish · S12 real screenshots → landing · S13 final review + full gates + PR.
Controller dispatches each, reviews between, runs concurrently only where file-disjoint; anything adding an EF migration is serialized.

## 5. Slices in detail
- **S1** Design-system foundation: tokens (zIndex/iconSize/blur); primitives (Modal, BottomSheet, Skeleton, ProgressBar, Segmented); Moti config + `LottieHost` (reduced-motion → poster) + motion recipes; finish reduced-motion. Locked first.
- **S2** Cash+Tournament (critical path): LocalSession, LocalNewGame, LocalSessionSummary, NewGame, SessionScreen (live + Final Count), tournament dashboard/clock/payout/blind editors. AnimatedNumber stacks/pots, Moti enters, Lottie game-end, 44px, AA, reduced-motion.
- **S3** Settlements+History+Leaderboard: SettlementScreen, PendingSettlements, AllSessions, LocalSessions, RecapCard, GroupDetail, GroupsList, Leaderboard, PlayerProfile/H2H.
- **S4** Premium Study+Paywall: lesson/quiz/Spot Trainer/Decision Trainer UI, PaywallScreen, PremiumGate.
- **S5** Auth+Settings+shared: Login/Register, Profile, Edit/CreateGroup, CurrencyPicker, NotificationPreferences, Achievements, Onboarding(V2), shared Empty/Error/loading.
- **S6** AI Coach (§6). **S7** Cloud Sync (§7). **S8** Advanced Bankroll Analytics: variance/std-dev, win-rate %, ROI, best/worst/avg, filters (cash/tourn, stake bucket, group), distribution; react-native-svg charts; premium-gated; reduced-motion.
- **S9** Honesty flip (§8). **S10** Mobile polish: swipe-actions, pull-to-refresh, haptics on money actions, transitions, Lottie moments; iOS+Android. **S11** Landing: chip both-direction + idle spin, brand SVG → header/footer/favicon/OG, stronger animation. **S12** real screenshots → landing. **S13** final review + full gates + PR.

## 6. AI Coach safety design (gates real money)
Server-authoritative model ALREADY EXISTS + verified: `/api/coach/analyze` reserves a credit via `CreditLedger.TryConsumeAsync` (hard cap 100/mo premium · 1 lifetime free, unique idempotency) BEFORE any Claude call; `EntitlementService` binary + fail-closed to free; rate-limited (12/min + per-user MinIntervalSeconds); `AuditLog` (AiCost/CreditSpend); `FraudEvaluator` (advisory); refund-on-failure; `MockCoachAiProvider` default, `AnthropicCoachAiProvider` only when keyed. **S6 = prove + ready, client never trusted:** TDD red→green — free=1-then-denied; premium=100-then-denied; monthly reset by PeriodKey; client-sent quota ignored; rate-limit denies within interval; provider failure refunds; **API key unset → fail-closed (mock/deny, never free-unlimited)**; idempotency prevents double-charge; expired sub → free; cost logged per call. **No real key, no flag flip during the build.**

## 7. Cloud Sync architecture (backup & cross-device restore)
Premium-gated; syncs on-device local/guest games + Study/Coach progress (account sessions/groups already cloud). **Backend:** `CloudBackup { UserId, Namespace ('localGames'|'study'|'coach'), Payload(jsonb), Version, UpdatedAt }`, unique `(UserId, Namespace)`; `GET/PUT /api/sync/{namespace}` with server-authoritative premium check + optimistic concurrency (version/etag); one EF migration (serialized). **Client:** `cloudSyncService` serializes each store → PUT; new device GET + merge into AsyncStorage (union by id, newest updatedAt wins); triggers = app-foreground, after game end, manual "Back up now"; `importedSessionId` powers local→account migration. **UI:** Settings → Cloud Sync (last-backed-up · Back up now · Restore · auto-sync toggle) + premium gate. Backup/restore semantics, no real-time/conflict UI for launch. **Extra review attention.**

## 8. Honesty-model changes (Wave C, AFTER the 3 ship)
App `features/premium/config.ts`: `comingSoon:false` for ai_coach/cloud_sync/advanced_bankroll (4 live; paywall "Soon" chips auto-hide). App tests: assert all 4 live, none coming-soon. Landing `lib/features.ts`: 3 → `live:true` + `buyHref:SITE.appUrl`; `__tests__/honesty.test.ts`: "exactly one live" → "four live, each with buyHref; coming-soon empty; store badges still no href". Store badges stay "Coming soon"; content stays "Expert-Calibrated". **Backend unchanged** (binary entitlement).

## 9. Per-area animation plan (Reanimated + Moti + Lottie)
Screens: Moti enter/stagger, PressableScale everywhere, AnimatedNumber for money. Hero moments (Lottie, lazy + poster fallback): game-end, achievement unlock, settle-complete, coach "thinking", empty states. Mobile (S10): swipe actions, pull-to-refresh, haptics on money actions, directional transitions. Every animation: transform/opacity only (CLS-safe), reduced-motion fallback, perf-budgeted mid-device.

## 10. Global gates (every slice)
`tsc --noEmit` · `jest` (app) · `vitest` (landing) · `expo export -p web` · `dotnet build` + `dotnet test` (backend slices) · `next build`/`next lint` (landing) · axe 0 violations (UI) + controller Playwright (LCP/CLS/contrast/screenshots).

## 11. Risks & activation
AI Coach go-live needs the Anthropic key on Railway (user action) + user OK to flip coach/paywall flags — NOT during this build. Cloud Sync = largest net-new surface (migration + merge) → most review. Lottie + logo shown for approval before ship. Execute slice-by-slice with wave-boundary check-ins.
