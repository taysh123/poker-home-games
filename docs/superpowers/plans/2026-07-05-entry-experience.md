# Entry Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1.2s skippable code-driven BrandSplash + Welcome chooser for signed-out users (guest data preserved), Login/Register restrained polish, GuestHome mount stagger — web + native parity, flags `v2Splash`/`welcome` ON-at-launch on this frozen branch.

**Architecture:** Pure routing helpers (`entryRouting.ts`) drive `AppNavigator`'s guest-tree `initialRouteName`; `WelcomeScreen` is a stateless chooser that never touches storage; `BrandSplash` is rewritten around pinned timeline constants (`splashTimeline.ts`); all motion uses the existing Reanimated shared-value / Moti-recipe layer (web-safe, reduced-motion aware).

**Tech Stack:** Expo SDK 54, React Navigation native-stack, Reanimated 4, Moti recipes (`components/motion`), jest-expo + @testing-library/react-native.

## Global Constraints

- Branch: `feature/entry-experience` off `feature/lottie-polish` (worktree `.claude/worktrees/launch-phase-1-2`). Frozen PRs #4/#5/#6/#11 untouched; nothing merged.
- Splash total <= 1300ms animated, <= 800ms reduced-motion; always skippable; exit shorter than enter.
- No new Lottie usage on splash/welcome; code-driven motion only; no `entering`/layout animations (web rule).
- Welcome/chooser performs **zero storage writes** (guest data preservation).
- Copy: tagline `YOUR HOME GAME, HANDLED` (splash) / `Your home game, handled.` (welcome); byline `BY TRUE STORY LABS`; legal copy identical to LoginScreen's existing block.
- Tokens only — no hardcoded hex/font sizes in new code (`theme/colors|typography|spacing|radii`).
- Gates after each task: `npx tsc --noEmit` and `npx jest` from `apps/poker-mobile`; `npx expo export -p web` at slice boundaries.
- Touch targets >= 44pt; `accessibilityRole`/labels on all new interactive elements.

---

### Task 1: Entry routing helpers + flags (TDD)

**Files:**
- Create: `apps/poker-mobile/src/navigation/entryRouting.ts`
- Create: `apps/poker-mobile/src/navigation/__tests__/entryRouting.test.ts`
- Modify: `apps/poker-mobile/src/config/features.ts` (add `welcome` flag; `v2Splash`+`welcome` PROD true)
- Modify: `apps/poker-mobile/src/config/__tests__/features.test.ts` (pin updates)

**Interfaces:**
- Produces: `initialGuestRoute(opts: { showLanding: boolean; welcomeEnabled: boolean; hasSeenOnboarding: boolean }): 'Landing' | 'Welcome' | 'Onboarding' | 'MainTabs'`; `guestContinueTarget(hasSeenOnboarding: boolean): 'Onboarding' | 'MainTabs'`.

- [x] Step 1: failing tests (`entryRouting.test.ts`): Landing wins; Welcome when enabled; legacy Onboarding/MainTabs when disabled; continue-target both arms.
- [x] Step 2: run jest — fails (module missing).
- [x] Step 3: implement `entryRouting.ts` (pure, no imports beyond types).
- [x] Step 4: update `features.ts`: add `'welcome'` to `FeatureFlag`, `PROD_FLAGS: { v2Splash: true, welcome: true }`, BETA/DEV entries true; update `features.test.ts` expected-ON set to `nav5, onboardingV2, study, content, retention, immersive, v2Splash, welcome` + dedicated pins with kill-switch comments.
- [x] Step 5: jest + tsc green — commit `feat(entry): pure entry routing + welcome/v2Splash launch flags`.

### Task 2: WelcomeScreen + navigator wiring (TDD)

**Files:**
- Create: `apps/poker-mobile/src/screens/WelcomeScreen.tsx`
- Create: `apps/poker-mobile/src/screens/__tests__/WelcomeScreen.test.tsx`
- Modify: `apps/poker-mobile/src/navigation/AppNavigator.tsx` (RootStackParamList `Welcome: { firstRun: boolean }`; guest tree registration before Onboarding gated `isFeatureEnabled('welcome')`; `initialRouteName` from `initialGuestRoute`)

**Interfaces:**
- Consumes: `guestContinueTarget` (Task 1); `PrimaryButton` (`variant="gradient" | "outline"`); `slideUpSequence/staggerIn` + `MotiView` from `components/motion`; `useLocalGames()` (`games`, `activeGame`); `track`, `markSignupIntent` from `utils/analytics`.
- Produces: route `Welcome` with `initialParams={{ firstRun: !hasSeenOnboarding }}`.

- [x] Step 1: failing render test: renders both CTAs + wordmark; guest press — `navigation.reset` to `MainTabs` (firstRun=false) / `Onboarding` (firstRun=true); **no storage writes** (mock `utils/storage`, assert `setItemAsync`/`deleteItemAsync` never called); sign-in press — `navigate('Login')` + `markSignupIntent`.
- [x] Step 2: jest — fails.
- [x] Step 3: implement screen per spec section 4 (wordmark block, CTA stack guest-primary, reassurance line when local games exist, legal + byline, 4-group stagger 0/70/140/210ms x 320ms, a11y labels).
- [x] Step 4: wire AppNavigator (registration + initialRouteName + params).
- [x] Step 5: jest + tsc green — commit `feat(entry): Welcome chooser screen — explicit guest choice, guest data untouched`.

### Task 3: BrandSplash 2.0 (TDD timeline)

**Files:**
- Create: `apps/poker-mobile/src/components/brand/splashTimeline.ts`
- Create: `apps/poker-mobile/src/components/brand/__tests__/splashTimeline.test.ts`
- Rewrite: `apps/poker-mobile/src/components/brand/BrandSplash.tsx`

**Interfaces:**
- Produces: `SPLASH` const (LOGO_IN 320, WORD_DELAY 120, WORD_IN 340, TAG_DELAY 280, TAG_IN 280, EXIT_AT 900, EXIT 300, TOTAL 1200, REDUCED_HOLD 600, SKIP_EXIT 180); `splashDurations(reduced: boolean): { total: number; exit: number }`.
- BrandSplash keeps prop contract `{ onDone: () => void }` (App.tsx unchanged).

- [x] Step 1: failing tests: TOTAL = EXIT_AT + EXIT = 1200 <= 1300; reduced total 600 <= 800; EXIT <= 300 (faster than the 560ms enter block); SKIP_EXIT < EXIT; splashDurations arms.
- [x] Step 2: jest — fails.
- [x] Step 3: implement constants + rewrite component: single-brand (logo + wordmark + tagline + byline), shared-value opacity/translate/scale only, root Pressable always-skippable (`accessibilityLabel="Skip intro"`), exit fade via animated root opacity, reduced — static frame + `setTimeout(onDone, REDUCED_HOLD)`, completion guard ref (skip/timer race). Remove TSL frame + ace-spade Lottie + `polish`-flag skip gate.
- [x] Step 4: jest + tsc green — commit `feat(entry): BrandSplash 2.0 — 1.2s single-brand, always skippable, reduced-motion static, web parity`.

### Task 4: Login/Register polish + GuestHome stagger + web shell

**Files:**
- Modify: `apps/poker-mobile/src/screens/LoginScreen.tsx`, `RegisterScreen.tsx` (Moti entrances replace legacy Animated; tokenized type; `bgDecor2` — `colors.infoFaint` @ 0.35 opacity; Login guest link via `guestContinueTarget`; PressableScale for close/links)
- Modify: `apps/poker-mobile/src/screens/GuestHomeScreen.tsx` (header + hero one-time mount stagger)
- Modify: `apps/poker-mobile/App.tsx` or `app.json` (web body background `#0A111B` — mechanism verified against actual export output)

- [x] Step 1: Login/Register migration (structure/copy unchanged; entrance groups 0/80/160/220ms). Login guest link TDD'd (`LoginScreen.test.tsx`: MainTabs/Onboarding arms + zero-storage-write pin).
- [x] Step 2: GuestHome brand header + hero cards wrapped in `MotiView {...slideUpSequence({ reduced, delay })}` (mount-once; upsell joins as group 2 for a coherent cascade).
- [x] Step 3: web shell background (document.body/documentElement at App module scope on web). Verified against real export output: `web.themeColor` IS injected as `<meta name="theme-color">`; `web.backgroundColor` does NOT style `<body>` — the JS paint is the operative fix.
- [x] Step 4: jest + tsc + `npx expo export -p web` green — commit `feat(entry): restrained auth polish + GuestHome entrance + navy web shell`.

### Task 5: Verification + ship (frozen)

- [x] axe (WCAG 2.1 AA) on Welcome/Login/Register/GuestHome via harness pattern — 0 violations (fixed: auth-card divider caption textDim → textMuted, ratio 1.69 → ~4.9). Splash frame a11y verified manually (single Pressable, role button, "Skip intro" label; transient surface).
- [x] Playwright stills (real web export, 390×844@2x + desktop): splash mid-frame, Welcome first-run / returning-with-seeded-game / reduced-motion, Login, Register, GuestHome post-choice with guest data byte-intact. 10/10 behavioral checks. `%TEMP%\tpoker-verify\entry\`.
- [x] Full gates: tsc 0 - jest 76/76 suites 620/620 tests - expo export green.
- [x] Code-review pass (adversarial, multi-agent workflow: 7 lenses → refuter panels), findings fixed: SplashGate (entrances no longer play hidden under the splash / no double-exposed handoff), logout → Welcome reset (MainTabs survives the tree swap; initialRouteName can't do it), BrandSplash skip/exit/re-arm guards (+8-test lifecycle suite), context-aware Login guest link (dismiss over app, preserve invite flows), AsyncStorage zero-write pin, race-default pin.
- [x] Push `feature/entry-experience`; open PR (base `feature/lottie-polish`) marked **FROZEN for launch** → **PR #14** (gitleaks clean, 8 commits). RESUME doc pointer updated via docs PR to main. New merge order at launch: **#4 → #5 → #6 → #14 → #11**.

## Self-Review

- Spec coverage: sections 2.1-2.7 map to Tasks 3 (splash), 2 (welcome/CTA), 1 (flags), 4 (polish); scope A — Tasks 3/4/5 (code-driven + export verification); scope B — Tasks 1/2 (routing TDD + no-write test). Logout-to-Welcome and Landing-wins covered by Task 1 tests.
- No placeholders: exact constants, routes, delays, and copy specified above or in spec section 4.
- Type consistency: `guestContinueTarget(hasSeenOnboarding: boolean)` used by Welcome (Task 2, via `firstRun` param inversion) and Login guest link (Task 4).
