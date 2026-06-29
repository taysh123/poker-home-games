# T Poker V2 — UX/UI Audit

**Phase:** V2 Product Polish & Launch Preparation (doc 1 of 2) · **Branch:** `feature/v2-poker-platform` (no PR) · **Date:** 2026-06-20
**Companion:** `docs/v2-product-polish-plan.md` (onboarding, funnel, engagement, content roadmap).
**Method:** screen-by-screen review of the live code, scored against the `ui-ux-pro-max` rule taxonomy (Accessibility → Touch → Performance → Style → Layout → Type/Color → Animation → Forms → Navigation → Data). Severity: 🔴 launch-relevant · 🟠 should-fix · 🟡 polish.

**Headline:** the design system is genuinely strong — well-tokenized (`theme/colors|typography|spacing|radii`), a 3-face type system (DM Serif / Sora / Inter), sophisticated motion (`AnimatedNumber`, `Shimmer` skeletons, `Celebration`, `AchievementUnlock`), and a coherent dark "Velvet Table" brand. The gaps are **not visual craft** — they are **navigation scale, onboarding/conversion flows, accessibility labels, and missing error/offline states**. Nothing requires a redesign.

---

## 0. Top findings (read this first)

| # | Finding | Rule | Sev |
|---|---------|------|-----|
| 1 | **Bottom tab bar holds up to 7 tabs** when all pillar flags are on (Home, Sessions, Bankroll, Study, Coach, Groups, Stats) | `bottom-nav-limit` (max 5) | 🔴 |
| 2 | **Onboarding never introduces the V2 pillars** (Bankroll/Study/Coach) or prompts account creation — it's the v1 3-slide carousel ending on guest Home | `progressive-disclosure`, retention | 🔴 |
| 3 | **Premium funnel is thin** — paywall is only reachable from a Coach link + Profile; no contextual triggers, no plan price shown pre-select, no trial, restore has no loading | conversion | 🔴 |
| 4 | **Icon-only buttons lack accessibility labels** (logout, notifications, add, back) across screens | `aria-labels`, `voiceover-sr` | 🔴 |
| 5 | **No engagement re-entry loop** — streaks + achievements exist but nothing schedules a streak/study reminder; push is wired only for the notifications inbox | reminders, retention | 🔴 |
| 6 | **Coach "Screenshot" method ships a placeholder** ("part of the Coach roadmap") visible to users | feature completeness | 🟠 |
| 7 | **Study "Decision Trainer" doesn't filter spots** and has no results/stats; identical to Spot Trainer under the hood | feature completeness | 🟠 |
| 8 | **Missing error + offline states** on Bankroll, Study, CoachResult; silent graceful degradation everywhere | `error-recovery`, `offline-support` | 🟠 |
| 9 | **Bankroll date entry is a raw `YYYY-MM-DD` text field** (no date picker) | `input-type-keyboard`, `no-precision-required` | 🟠 |
| 10 | **`textDim` (#3A4A5A) used for placeholder/disabled text fails contrast** (~1.9:1 on surface); verify `textMuted` borderline (~4.8:1) | `color-contrast`, `color-accessible-pairs` | 🟠 |
| 11 | Entrance animations re-run on every tab focus (`useFocusEffect`) → re-animate flicker | `motion-consistency`, `interruptible` | 🟡 |
| 12 | Paywall plan toggle hides the *other* plan's price until selected; no FAQ/support link | `progressive-disclosure`, conversion | 🟡 |

---

## 1. Navigation (cross-cutting) 🔴

**What's good:** two trees (guest vs authed) swap automatically on auth change; both expose `MainTabs`; spring-pop tab icons; persistent `LiveGameBar`; deep-link/pending-invite resume.

**Problems:**
- **Tab overload (`bottom-nav-limit`, `nav-hierarchy`):** with `bankroll`+`study`+`coach` flags on, the bar is **7 items**. iOS HIG / Material both cap practical bottom nav at **5**. At 7, labels truncate, tap targets shrink, and the IA reads as undifferentiated.
  - **Recommendation:** collapse to **5 max**. Proposed top level: **Play** (Home), **Track** (Bankroll + Sessions + Stats merged under a "Track" hub), **Study**, **Coach**, **Groups**. Or keep Home/Sessions/Study/Coach/Profile and move Bankroll+Stats into a "Track" hub screen. Decide the canonical 5 before flags flip on.
- **Pillars appear with no introduction** — a tab silently materializes when a flag flips; first tap drops the user into a feature with no context (`empty-nav-state`, `progressive-disclosure`).
- **Client feature flags are build-time** — flipping a pillar needs an app release; no remote kill (also noted in the architecture review). Make flags server-driven for safe staged rollout.
- **Notifications deep-linking** is inbox-only; taps don't route to the specific session/group (`deep-linking`).

## 2. Onboarding (`OnboardingScreen`) 🔴

3 slides (Track Every Game / Play With Your Crew / Know Your Numbers) → `replace('MainTabs')`. Clean visually; strategically thin.

- **No pillar introduction** — Bankroll/Study/Coach (the entire V2 thesis) are never shown.
- **No account-creation moment** — it ends on guest Home; account is an afterthought upsell card. This is the single biggest retention leak: identity is required for cloud stats, groups, AND any AI.
- **Skip captures nothing** — no email, no "what brings you here," no first-action nudge.
- **No first-run "aha"** — best onboarding ends with the user *doing* the core action (start a game / run one analysis), not reading 3 slides.
- Full redesign is in the companion plan (§ Onboarding).
- Minor: no swipe-back to a previous slide; Skip has no confirm (`escape-routes` is fine; just note).

## 3. AI Coach (`CoachScreen` / `CoachInputScreen` / `CoachResultScreen`) 🟠

**Strong bones.** Clear disclaimer, credit chip, 3 method cards, history list with `EmptyState`, structured result (summary/mistakes/good/alts/tips), correct error→toast mapping (`requires_account`/`rate_limited`/`unavailable`/`no_credits`→paywall).

- 🟠 **Screenshot method is a placeholder** shipped to users ("part of the Coach roadmap" + "Run demo analysis"). Either hide it behind the flag until real, or implement upload. A visible dead-end erodes the premium feel.
- 🟠 **CoachResult has no loading state** and a bare "Analysis not found" fallback (it reads from in-memory history, so a cold deep-link breaks). No re-analyze / share / save-to-favorites (`success-feedback`, retention).
- 🟡 Credit chip copy is good but the **upgrade path only shows for `lifetime` (free) tier** — premium users low on monthly credits get no top-up CTA (ties to B5 top-ups).
- 🟡 Input form: optional vs required fields aren't visually distinguished (`required-indicators`); validation error sits below the form (`error-placement` ok, but make it more prominent / focus the field).
- ✅ No anonymous AI, fail-closed — matches the server contract.

## 4. Bankroll (`BankrollScreen` / `LogSessionScreen`) 🟠

**Strong dashboard:** hero P&L (`AnimatedNumber`), ROI/ABI/ITM stat row, `BankrollChart`, filter chips, `EmptyState`, gradient CTA.

- 🟠 **`LogSessionScreen` uses a raw `YYYY-MM-DD` text input** — violates `input-type-keyboard` / `no-precision-required`; needs a native date picker. Tags split on comma without per-tag trim.
- 🟠 **No error/feedback on AsyncStorage write failure** — silent swallow; user edits could vanish without notice (`error-recovery`, `form-autosave`).
- 🟡 **Chart isn't interactive** — no tap-to-inspect point/value (`tooltip-on-interact`, `touch-target-chart`), no axis labels (`axis-labels`).
- 🟡 No empty *chart* state distinct from the empty session list; no export/share.
- 🟡 Filter chips don't persist; no loading skeleton (acceptable — local data).
- ✅ Integer-cents, schema-versioned + quarantined store, pure tested analytics.

## 5. Study (`StudyScreen` / `SpotTrainerScreen`) 🟠

**Good loop foundation:** streak hero (`AnimatedNumber` + flame), daily-goal progress bar, accuracy/answered/spots stats, two trainer modes, `Celebration` on ≥70%.

- 🟠 **"Decision Trainer" is non-functional differentiation** — the `mode` flag exists but the engine doesn't filter spots, so it's a clone of Spot Trainer with no end screen/stats (`empty-data-state`, feature completeness). Either build real continuous drilling with running stats, or merge the two.
- 🟠 **Dataset is hardcoded** (`STARTER_DATASET`, `isIllustrative`) and the UI advertises "real solver data can be imported later" with no import path — sets an expectation it can't meet yet.
- 🟡 No way to change the daily goal from the screen; no streak-history viz (only current+best).
- 🟡 Confetti threshold (70%) is arbitrary; the "illustrative" disclaimer is easy to miss (place it more honestly near the CTA).
- ✅ Pure tested logic (169-grid, range parser, streaks, trainer eval); versioned store.

## 6. Paywall (`PaywallScreen`) 🔴 (funnel) / 🟡 (screen)

Screen itself is attractive: hero, feature grid, annual/monthly toggle with "Best value" badge, gradient CTA, restore, fine print, premium "you're in" state.

- 🔴 **Funnel is thin** (see companion plan): entered only via a Coach link + a Profile row. No contextual triggers (hitting the free-credit wall, a streak milestone, a "you'd have unlocked X" moment), no soft paywall, no trial, no annual-default anchoring beyond the badge.
- 🟡 **Selected-plan-only price** — the non-selected plan's price/savings should be visible *before* selecting (`progressive-disclosure`); show both prices + the savings delta up front.
- 🟡 **Restore has no loading state** (`loading-buttons`); no FAQ/"purchase help" link (`error-recovery`).
- 🟡 Single primary CTA ✅ (`primary-action`), but consider a value-stack reminder right above the button.
- ✅ Post-purchase refreshes server entitlement (B4 wiring).

## 7. Profile (`ProfileScreen`) 🟡

Comprehensive: avatar (emoji+color via `Avatar`), edit profile, change password, subscription link, about/support, responsible-gaming disclaimer, danger zone with confirm. Good button loading states + toasts.

- 🟡 **Generic backend errors** — "current password incorrect" surfaces as a generic toast (`error-clarity`).
- 🟡 No confirm before an **email change** (account-recovery implication).
- 🟡 Password rules are client-only (<8 chars); show inline helper + strength (`input-helper-text`).
- ✅ Destructive action is isolated + confirmed (`destructive-nav-separation`, `confirmation-dialogs`).

## 8. Splash (`SplashScreen` + `BrandSplash`) 🟡

- ✅ `BrandSplash` (TSL → T Poker crossfade, ~3.5s, asset-fail fallback) is well-crafted and on-brand.
- 🟡 The ~3.5s branded sequence is great once but can feel long on every cold start — consider shortening after first run or making it interruptible on tap (`interruptible`).
- 🟡 `SplashScreen` has no error/timeout path if bootstrap stalls (rare).

## 9. Cross-cutting state coverage

| State | Coverage |
|------|----------|
| **Empty** | ✅ Home, GuestHome, Coach, Bankroll, CoachResult. ❌ Study (n/a — always has data), no distinct empty-chart state. |
| **Loading** | ✅ Home (skeletons), buttons (spinners). ❌ Bankroll/Study/Coach lists (local — ok), CoachResult (none), no global slow-network skeletons. |
| **Error** | ⚠️ Mostly **silent graceful degradation**. ❌ No surfaced error/retry on Bankroll, Study, CoachResult; Home swallows API errors with no "couldn't refresh" affordance (`error-recovery`, `timeout-feedback`). |
| **Offline** | ❌ **None** app-wide — no "you're offline" banner or degraded mode (`offline-support`, `network-fallback`). Coach already fails closed to `unavailable`; surface it as a friendly persistent state. |

## 10. Accessibility & touch (CRITICAL category) 🔴/🟠

- 🔴 **No `accessibilityLabel` on icon-only controls** (logout, notifications bell, add "+", back chevron, filter chips) — VoiceOver reads nothing meaningful (`aria-labels`, `voiceover-sr`).
- 🟠 **Contrast:** `textDim #3A4A5A` on `surface #1A2535` ≈ **1.9:1** — fails even the 3:1 UI bar; only acceptable for truly decorative/placeholder, never body. `textMuted #7A8A99` on `background` ≈ **4.8:1** — passes normal text but is borderline; don't use it below 13px. Audit every `textDim` text usage (`color-contrast`).
- 🟠 **Dynamic Type / reduced-motion** not handled — fixed font sizes (token system), and entrance/confetti animations don't check `prefers-reduced-motion` (`dynamic-type`, `reduced-motion`).
- ✅ `PressableScale` gives press feedback + haptics; `hitSlop` used on small icons (but still add labels).
- ✅ Touch targets generally ≥44pt via padded cards; verify filter chips + small icon buttons.

## 11. Animation & performance 🟡

- ✅ Excellent motion vocabulary (`AnimatedNumber`, `Shimmer`, `Celebration`, spring `PressableScale`, `GlassView`), web-safe fallbacks.
- 🟡 **Entrance animations re-run on every focus** (Home) — re-animates hero/content on each tab return; feels twitchy (`motion-consistency`). Run once per mount or gate on first focus.
- 🟡 Skeletons flash on fast connections (fine); ensure they show only for >300ms loads (`progressive-loading`).
- 🟡 Confirm no animations animate width/height (use transform/opacity — mostly already true).

## 12. Retention & engagement opportunities (gaps, not bugs)

The *primitives exist* (streaks, achievements, `Celebration`, `AchievementUnlock`, push infra) but aren't woven into a loop:
- **No re-entry trigger** — nothing schedules "your streak is at risk" / "daily goal" / "you have N free analyses" notifications. Push is only used for the notifications inbox.
- **No progression surface** — achievements live on Stats; there's no "level/rank/XP," no weekly goals beyond Study's daily count, no profile flair.
- **No cross-pillar loop** — finishing a game doesn't nudge "analyze your toughest hand" (Coach) or "log it to your bankroll" (Track). The pillars don't feed each other.
- **No win-back** — lapsed users get nothing.
- These are designed in the companion plan (§ Daily engagement systems & § Content architecture).

---

## Severity roll-up

- 🔴 **Launch-relevant (do in V2.1 before GA):** nav ≤5 tabs; onboarding redesign + account-creation moment; premium funnel + contextual triggers; accessibility labels; one engagement re-entry loop (streak/study/credit reminder).
- 🟠 **Should-fix:** Coach screenshot (hide or build); Study decision-trainer (merge or build); error+offline states; bankroll date picker; contrast pass.
- 🟡 **Polish:** chart interactivity; paywall price transparency + restore loading; profile error clarity; focus-once entrance animations; reduced-motion/dynamic-type; splash length.

All of the above is sequenced and designed in **`docs/v2-product-polish-plan.md`**.
