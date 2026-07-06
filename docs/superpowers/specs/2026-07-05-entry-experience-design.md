# Entry Experience — Design Spec

Date: 2026-07-05 · Branch: `feature/entry-experience` (stacked on `feature/lottie-polish`, PR #6)
Status: approved by product owner (chat, 2026-07-05) with scope updates A (web parity) + B (entry choice).

## 1. Goal

A premium, restrained entry experience for T Poker: a ~1.2s branded splash on every cold
start, resolving into a **Welcome chooser** for signed-out users ("Continue as guest" /
"Sign in") and straight into Home for signed-in users. Velvet Table tone throughout —
dark navy, restrained gold, no casino flash. First-class on **web and native**.

## 2. Approved decisions (product owner)

1. **Splash frequency/length**: every cold start, ~1.2s, always skippable (tap anywhere).
   Reduced motion → static logo frame (~0.6s), no choreography.
2. **Signed-in users skip Welcome** — splash resolves directly into Home.
3. **Welcome boldness**: restrained elevated upgrade — keep the existing auth-screen
   structure (logo block / wordmark / hierarchy), staggered fade-in, polished press
   states. Premium and calm.
4. **Splash flag posture**: `v2Splash` planned **ON at launch**; the flag remains a
   kill-switch. Same posture for the new `welcome` flag (this PR is frozen until launch;
   merging it *is* the launch action).
5. **Assets**: code-driven motion only (Reanimated/Moti). No hand-authored Lottie. If a
   real Lottie would be meaningfully better somewhere, pause and ask (none identified —
   at 1.2s the ace-spade Lottie cannot read and is removed from the splash; it remains
   available in `assets/lottie/`).
6. **TSL frame**: dropped from the splash (1.2s budget makes it impossible; its
   blue/purple palette clashes with navy+gold). Credit preserved as the quiet
   "BY TRUE STORY LABS" byline on the splash and Welcome (Login already has it).
7. **CTA hierarchy on Welcome**: **"Continue as guest" is primary** (gold gradient) —
   returning guests see this chooser every cold start and deserve the fastest tap;
   sign-in users see Welcome only until they sign in. "Sign in" is a strong outline
   button directly below. (One-line change to flip if desired.)

### Scope update A — web parity
The splash + welcome motion is **code-driven (Reanimated shared values / Moti)** so it
animates identically on native and web. No `entering`/layout animations (existing web
rule). Any Lottie moment keeps the LottieHost poster-fallback pattern (none remain on
these surfaces). Verify with `expo export` + the Playwright harness. Kill the white
web-shell flash if the export allows it.

### Scope update B — entry choice instead of silent guest
Signed-out users land on the **Welcome chooser** after the splash — guest mode is
entered only by explicit choice. Requirements:
- Guest local data fully preserved: "Continue as guest" resumes exactly where the user
  left off. The chooser **never writes or clears guest data** — the local-games and
  onboarding keys are pinned untouched by test across BOTH storage layers (secure
  storage + AsyncStorage, where `tpoker.localGames.v1` lives). The Sign-in arm records
  an analytics-only signup-intent marker (attribution for `account_created`, same as
  the pre-existing GuestHome upsell path) — it never touches guest data.
- Signed-in users never see Welcome.
- One tap to guest; a chooser, not a wall.
- Routing logic is TDD'd (signed-in → Home; signed-out → Welcome; guest choice →
  first-run → Onboarding funnel, returning → MainTabs with existing local state).

## 3. Flow (after this change, flags ON)

```
cold start
  └─ BrandSplash overlay (~1.2s, tap-to-skip, reduced→static ~0.6s)
       ├─ user !== null  → authed tree → Home            (Welcome not in tree)
       └─ user === null  → guest tree:
            ├─ web root + paywall flag → Landing (marketing page is its own chooser;
            │                            Welcome is NOT initial in that case)
            └─ else → Welcome chooser
                 ├─ "Continue as guest" → first run → OnboardingV2 (pillar slides →
                 │                        starting-point router — funnel + analytics
                 │                        untouched) · returning → MainTabs (GuestHome,
                 │                        local games intact)
                 └─ "Sign in" → existing Login modal (X/back returns to Welcome);
                                auth success → tree swap → Home
```

Logout now lands on Welcome (explicit chooser) instead of silently on guest Home —
consistent with scope update B. Deep links (`/join/*`) still push their screens above
the initial route; the pending-invite stash flow is unchanged.

## 4. Screens

### BrandSplash 2.0 (`components/brand/BrandSplash.tsx`, flag `v2Splash`)
Single-brand, code-driven, `backgroundDeep` field (seamless with the native OS splash,
which uses the same color). Timeline (constants in `components/brand/splashTimeline.ts`,
pinned by tests):

| t (ms) | element | motion |
|---|---|---|
| 0–320 | logo badge | opacity in 320ms + spring scale 0.92→1 (damping 16, stiffness 190) |
| 120–460 | "T POKER" wordmark (DM Serif, goldLight, ls 4) | opacity + 8px rise |
| 280–560 | tagline "YOUR HOME GAME, HANDLED" (caps, goldMuted) + byline "BY TRUE STORY LABS" | opacity to 0.9 / 0.7 |
| 560–900 | hold | — |
| 900–1200 | whole overlay | opacity → 0 (exit faster than enter), then `onDone` |

Always skippable: root Pressable, `accessibilityRole="button"`, label "Skip intro";
tap → 180ms fast exit. Reduced motion: static composed frame, `onDone` at 600ms, no
fades. Idempotent completion (skip vs timer race guarded). No Lottie, no TSL frame.

### WelcomeScreen (`screens/WelcomeScreen.tsx`, flag `welcome`) — restrained
Structure mirrors the Login header language (calm, familiar):
1. Ambient decor circles (tokenized; no hardcoded blue).
2. Wordmark block: 100px gold-ringed logo tile (gold shadow) → "T POKER"
   (`displaySerif` 24, goldLight, ls 4) → 24×2 gold rule → tagline
   "Your home game, handled." (body, textMuted).
3. CTA stack: `PrimaryButton` **gradient** "Continue as guest" (primary); outline
   "Sign in" below. When local games exist, a reassurance line under the guest CTA:
   "Your games are saved on this device." (caption, textMuted).
4. Legal line (same 18+/not-gambling copy as Login) + "BY TRUE STORY LABS" byline.

Entrance: 4 stagger groups (wordmark → CTAs → reassurance/legal) at 0/70/140/210ms,
each `slideUpSequence` 320ms fade + 12px rise; reduced motion → instant. Analytics:
`welcome_shown` / `welcome_guest` / `welcome_signin` (+ `markSignupIntent()` on
sign-in). Touch targets ≥ 44pt; buttons are PressableScale-based (spring press states,
light haptic).

### Routing (`navigation/entryRouting.ts`, pure, TDD)
- `initialGuestRoute({ showLanding, welcomeEnabled, hasSeenOnboarding })` →
  `'Landing' | 'Welcome' | 'Onboarding' | 'MainTabs'` — Landing wins (web marketing
  entry is its own chooser), then Welcome when enabled, else legacy behavior.
- `guestContinueTarget(hasSeenOnboarding)` → `'Onboarding' | 'MainTabs'`.
- `AppNavigator` passes `initialRouteName` from `initialGuestRoute` (guest tree) so the
  pure function is load-bearing, not just documentation. Welcome gets
  `initialParams={{ firstRun: !hasSeenOnboarding }}`.

### Login/Register polish (unconditional in this frozen PR; restrained)
- Legacy RN `Animated` entrances → Moti `slideUpSequence` stagger (header/card/footer/
  legal at 0/80/160/220ms), reduced-motion aware.
- Tokenize hardcoded type: brand caps → `typography.caps` (+ls 3), title →
  `typography.display`, subtitle/footer/labels → body/label tokens.
- `bgDecor2` hardcoded blue `rgba(74,144,226,0.04)` → `colors.infoFaint` at 0.35 opacity
  (token-derived, same visual weight).
- Login gains a "Continue as guest" text link (below footer) → resets to the guest
  target (Onboarding on first run, else MainTabs); X close retained.
- TouchableOpacity → PressableScale for close/footer links (polished press states).

### GuestHome
One-time mount stagger for the brand header + hero cards (recent-games rows already
stagger); focus does not re-trigger.

### Web shell
Eliminate the white pre-JS flash on web if the export mechanism allows (body background
`#0A111B` — via app.json web config if honored, else earliest-possible JS). Verified
against the actual `expo export` output.

## 5. Flags & safety

- `v2Splash: true` and `welcome: true` in `PROD_FLAGS` **on this branch** (goes live
  only when the PR merges at launch). Each is an independent kill-switch:
  `v2Splash: false` → no splash overlay at all; `welcome: false` → legacy silent-guest
  entry (Onboarding/MainTabs), Welcome unregistered.
- `features.test.ts` prod pins updated accordingly (v2Splash + welcome join the
  expected-ON set).
- The 4 frozen launch PRs (#4/#5/#6/#11) are untouched; this branch stacks on the tip.
- No storage schema changes; no writes from the chooser; local guest data untouched.

## 6. Quality gates (per slice)

`npx tsc --noEmit` · `npx jest` · `npx expo export -p web` green; axe (WCAG 2.1 AA,
harness pattern) on Welcome/Login/splash frame; reduced-motion verified (OS setting on
native, `prefers-reduced-motion` emulation on web); Playwright stills (default,
reduced-motion, guest-resume with seeded local game); Expo Go on-device checklist for
haptics/springs/skip.
