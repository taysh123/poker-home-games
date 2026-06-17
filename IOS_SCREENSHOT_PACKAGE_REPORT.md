# iOS Screenshot Package — Report

_Generated June 17, 2026 · iPhone 6.5" App Store package · no app/production code modified._

## Summary

Produced an App-Store-compliant **iPhone 6.5" (1242 × 2688)** screenshot set from the
existing production captures, in a dedicated `assets/store/ios/` structure, plus the
existing 6.7" set and the resize sources. **6 screenshots** generated and validated
(exceeds the "at least 5" requirement).

## Files created

### `assets/store/ios/iphone-65/` — generated, 1242 × 2688 px (PNG)
| File | Resolution | Bytes |
|------|-----------|-------|
| `01-home.png` | 1242 × 2688 | 529,793 |
| `02-tournament-live.png` | 1242 × 2688 | 431,102 |
| `03-tournament-podium.png` | 1242 × 2688 | 377,397 |
| `04-final-count.png` | 1242 × 2688 | 516,722 |
| `05-cash-summary.png` | 1242 × 2688 | 261,508 |
| `06-stats.png` | 1242 × 2688 | 432,698 |

### `assets/store/ios/iphone-67/` — existing production set, 1290 × 2796 px
`01-home.png`, `02-tournament-live.png`, `03-tournament-podium.png`,
`04-final-count.png`, `05-cash-summary.png`, `06-stats.png`

### `assets/store/ios/source/` — resize sources, 1290 × 2796 px
Same six files (copies of the 6.7" originals).

### Docs
- `assets/store/ios/README.md` — package guide (dimensions, generation commands, upload steps)
- `IOS_SCREENSHOT_PACKAGE_REPORT.md` — this report

## Dimensions

- **Target:** 1242 × 2688 px (Apple iPhone 6.5" portrait) — **all 6 generated images match exactly.**
- **Source:** 1290 × 2796 px (iPhone 6.7"), 24bpp RGB PNG.
- **Transform:** uniform "cover" scale (×0.96279) → 1242 × 2692, then center-crop 4 px of
  height → 1242 × 2688. Aspect ratio preserved (no stretch); crop is 2 px top / 2 px bottom
  (status-bar / home-indicator margin) — visually imperceptible.

## Source files used

`apps/poker-mobile/store-assets/screenshots/ios-6.7/*.png` — the production web-bundle
captures from the Playwright harness `store-shots.js`. Copied into `source/` and reused
as the 6.7" deliverable in `iphone-67/`.

## Validation results

All 6 generated images pass:
- ✅ PNG signature (`89 50 4E 47 …`) and PNG container format
- ✅ Exactly 1242 × 2688 px
- ✅ Non-trivial file size (260 KB–530 KB), decodes cleanly
- ✅ No distortion (uniform scale), no black bars (cover fill), no stretching
- ✅ Visual spot-check (home, tournament-live): sharp, correct content, full-bleed

## Content coverage vs. requested themes

| Requested theme | Covered? | By |
|---|---|---|
| 1. Home screen | ✅ | `01-home` |
| 2. Session creation flow | ⚠️ Indirect | session lifecycle shown via `04-final-count` / `05-cash-summary`; no dedicated setup-wizard capture in the production set |
| 3. Tournament management | ✅✅ | `02-tournament-live`, `03-tournament-podium` |
| 4. Group management | ❌ Not in set | — |
| 5. Join game experience | ❌ Not in set | — |

## Warnings

1. **Group management & Join game screens are not in the current production screenshot
   set.** The shipped store screenshots are the **guest-flow** set (home / tournament /
   cash / stats). Group management and Join are **server-backed, authenticated** screens.
   Producing accurate captures requires running an authed Playwright flow against a live
   backend with a seeded account (e.g. extend `store-shots.js` using the patterns in
   `verify-authed-shots.js`) — out of scope for a from-existing-assets resize, and UI must
   not be fabricated. The 6 delivered shots still satisfy Apple's minimum and represent the
   core product.
2. **"Session creation flow" has no dedicated capture** — represented indirectly by the
   end-of-session shots. Add a wizard capture to the harness if a literal setup screen is wanted.
3. **4 px vertical crop** when converting 6.7" → 6.5" (different aspect ratios). It trims only
   status-bar/home-indicator margin; no content loss. For pixel-native 6.5", use the harness
   `ios-6.5` profile (see README "Alternative — native capture").

## Upload readiness

✅ **READY for App Store Connect — iPhone 6.5" slot.** Six valid 1242 × 2688 PNGs in
`assets/store/ios/iphone-65/`. The 6.7" slot is also covered (`iphone-67/`). Optional
enhancement before submission: add authed Group/Join captures if you want those themes
represented; not required for a compliant submission.
