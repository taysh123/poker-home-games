# Mobile-First Audit — June 2026

Method: Playwright walked the full guest flows (onboarding, dual entry cards,
tournament wizard/live/podium, cash game, The Final Count with a 5-player stress
case, action sheets, stats) at **320×568** and **375×667** viewports against the
production web bundle, checking horizontal overflow at every checkpoint and
action-button reachability. Code-level checks reviewed safe areas, modals, and
touch targets.

## Findings

| Area | 320×568 | 375×667 | Result |
|------|---------|---------|--------|
| Onboarding / guest home / entry cards | ✅ | ✅ | pass |
| Wizard (mode cards, players, review) | ✅ | ✅ | pass |
| Tournament live (blind clock, standings) | ✅ | ✅ | pass |
| Action sheets | ✅ | ✅ | pass |
| Podium + confetti | ✅ | ❌ +6px overflow | **FIXED** — Celebration container now clips particles (`overflow: hidden`) |
| The Final Count (5 players) | ❌ buttons clipped | ✅ | **FIXED** — stacks list height now adapts (`min(280, 25% of screen)`), modal max-height 94% |
| Stats | ✅ | ✅ | pass |

Re-run after fixes: **all checks pass on both viewports.**

## Code-level review (pass, no changes needed)

- **Safe areas**: every bottom bar uses `insets.bottom` padding (LocalSession bar,
  SessionScreen action bars, tab bar via navigator); headers own `insets.top`
  through ScreenHeader.
- **Touch targets**: PrimaryButton 52pt; ScreenHeader back 40pt + hitSlop ≥44pt
  effective; override row minHeight 48; mode cards minHeight 64; tab bar native sizes.
- **Modals**: all use the 40–60% scrim (`bgOverlay`/`modalOverlay`),
  KeyboardAvoidingView on input modals, `onRequestClose` for Android back.
- **Thumb reach**: primary actions bottom-anchored throughout (End Game bar,
  wizard CTAs, modal button rows at modal bottom).

## Deferred (acceptable, tracked)

- Landscape: portrait-locked by design (`orientation: portrait`) — store-acceptable.
- Dynamic Type at max accessibility sizes: hero numerals capped
  (`maxFontSizeMultiplier 1.3`); a full large-text pass is a future polish item.
- Physical-device pass (gesture bar, notches) recommended on the preview APK —
  browser viewports approximate but don't replace it.
