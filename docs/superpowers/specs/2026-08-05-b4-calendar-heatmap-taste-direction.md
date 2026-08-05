# B4 — Calendar + heatmap taste direction (DECIDED)

**Status:** decided and signed off by the owner, 2026-08-05. This is the reference B5–B7 build
against. Plan of record: `2026-08-05-q2-master-plan.md` §2 (Pillar 1).

Bankroll is a **free headline pillar and an acquisition hook** (owner decision, 2026-08-05 —
`advanced_bankroll` dropped from `PREMIUM_FEATURES` entirely). The calendar and heatmap must feel
premium-quality *because* they're free.

---

## The actual design problem

Not decoration — **which perceptual channel carries win-vs-loss.**

A GitHub contribution heatmap encodes one unsigned dimension (activity ≥ 0) on a single-hue ramp.
Poker P&L is **signed**: +₪400 and −₪400 must never look alike. Three states must stay distinct:

| State | `dayBuckets` shape |
|---|---|
| No session | absent from the sparse bucket list |
| Played, broke even | present, `netCents === 0`, `heatmapLevels` → `level: 0` |
| Played, won or lost | present, `level` ±1..N |

`ui-ux-pro-max` findings that bind this (chart + ux domains, react-native stack):

- **Heatmaps grade B on accessibility** — weakest of the 25 chart types. Its own stated mitigation
  is *"pattern overlay for colorblind users"* plus a numeric legend.
- **"Never convey information by colour alone" is HIGH severity.** Gold `#C9A84C` vs error
  `#E74C3C` is a weak pair under deuteranopia — both collapse toward yellow-brown.
  `BankrollHistogram` gets away with that pairing only because *position* carries the sign (losers
  left, winners right). **A calendar has no positional escape — the date owns the position.**
- **365 cells is the per-SVG budget** for a calendar heatmap. A full year fits; nothing more.

---

## DECISION: "The Tape" (shape + hue), with a luminance ramp for the year view

**Match the encoding to the resolution.** Each view uses the channel that actually works at its own
cell size, so no view is ever colour-alone.

| View | Cell size | Sign channel | Rationale |
|---|---|---|---|
| **Month** (B5) | ~44px | **shape + hue** — winners solid on a gold ramp, losers **hollow/ringed**, break-even a thin neutral outline, no session bare | A hollow ring is unmistakable at 44px and survives grayscale |
| **Year** (B6) | ~5px | **luminance + hue** — winners bright gold, losers dark desaturated red | Shape is illegible at 5px; luminance separation survives both the tiny scale *and* every form of colour-vision deficiency |

Magnitude comes from the `level` that `features/bankroll/logic/calendar.ts#heatmapLevels` already
computes (signed, relative to the largest `|netCents|` in the dataset, clamped `levelCount`).

### Directions considered and rejected

- **"The Ledger"** (encode with numbers — exact amounts in every cell; year view becomes a 12-month
  summary). Colourblind-safe by construction and cheapest, but **silently drops the daily year
  heatmap**, which is the whole acquisition-hook screenshot. Rejected for that reason, not on taste.
- **"Table Light"** standalone (encode with luminance + depth via glow/recess everywhere). Most
  distinctive, strongest colourblind channel — but glow means SVG filter primitives, and **filter
  support is patchy on Android while react-native-web renders it fine**: the exact
  web-looks-perfect/native-degrades trap B2 just fixed. Rejected as a standalone; its luminance
  *idea* is folded into the year view without the filters (see constraint 4).

---

## Signed-off constraints (verified against the code, not assumed)

1. **The month grid goes full-bleed.** Screen padding is `spacing.xl` (20/side); `Card` defaults to
   `padding: spacing.lg` (16). On a 375pt screen that leaves 303px for 7 columns → **~40px cells,
   under the 44×44 minimum**. Even at `Card padding={0}` a 360dp Android gives ~42px. Real 44px
   targets require cancelling the screen padding for that section. *Accepted as a layout decision.*
2. **Year cells are never tappable.** 53×7 is ~5px per cell at any width; `hitSlop` cannot rescue a
   dense grid (neighbouring slops overlap, edge taps become ambiguous). The year view is **one
   `<Svg accessibilityRole="image">` with a composed label** — the `BankrollLineChart` house pattern
   (onLayout width, static SVG, reduced-motion safe by construction). Drill-in happens via a
   **month** affordance, never a per-day tap. This also keeps `a11yRoleRatchet` trivially satisfied
   there: a pure-image grid adds **zero** touchables.
3. **Month day cells need roles in the first commit.** The `.map()` of day cells is one JSX call
   site, and a new component file has ratchet ceiling `0` (`CEILING[rel] ?? 0`), so any unroled
   touchable fails immediately. Roles right the first time — no ceiling raise.
4. **NO SVG filter primitives in the year-view luminance ramp** (owner requirement, 2026-08-05).
   No `FeGaussianBlur`, no filter-based glow. Luminance comes from **fill lightness/opacity on plain
   `<Rect>`s**, so it renders identically on Android, web and iOS. **The B6 fleet must confirm this
   on a real Android path, not just web.**
5. **Pagination lands in B5, not B6** (owner requirement, 2026-08-05). Session history is currently
   unpaginated and a calendar is an explicit invitation to year-scale data — handle it *before* the
   year view invites it, not after.

## Standing brief

- Velvet Table identity: deep navy + gold, premium and calm, **never casino**. Gold stays sparing —
  primary CTAs, live indicators, key financial numbers.
- Tokens only: `theme/colors.ts`, `typography.ts`, `spacing.ts`, `radii.ts`. No raw hex, no
  hardcoded font sizes.
- React Native specifics (`ui-ux-pro-max`, react-native stack): `Pressable` over
  `TouchableOpacity`; visible press feedback; `FlatList` for 50+ items; memoized row components;
  stable `keyExtractor` (never index).
- A legend is required — the heatmap's own accessibility mitigation calls for it, and a signed
  ramp is not self-evident without one.
