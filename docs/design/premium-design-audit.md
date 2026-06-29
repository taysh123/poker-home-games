# Premium Design / Motion Audit (Deliverable F)

> **Status: built on the existing mature design system; flag-gated.** The new solver surfaces + reusable
> primitives are token-driven, web-safe, and reduced-motion-aware. No production-visible change (the `solver`
> flag is OFF, and the new shared primitives are consumed only by the gated workspace).

## Foundation reused (not rebuilt)
Tokens (`theme/colors|typography|spacing|radii|shadows|motion`), 12 component primitives (Card, Chip, Screen,
BrandHeader, StateView, ListRow, PrimaryButton, Empty/ErrorState, Skeleton*, SectionTitle), 5 motion primitives
(PressableScale, Shimmer, AnimatedNumber, GlassView, Celebration), and `useReducedMotion`/`useScreenEntrance`.
The solver workspace consumes these — no new token system, no parallel components.

## New reusable primitives (token-driven, web-safe)
- `HoverCard` — web hover **and focus** popover (keyboard-accessible); mobile passthrough; **no animation**
  (reduced-motion-safe by construction); surface/border/shadow from tokens.
- `DetailSheet` — mobile bottom sheet; `animationType` flips to `none` under `useReducedMotion`; tokens throughout.
- `SplitPane` — responsive layout primitive (desktop multi-panel / mobile stacked) via `useResponsive`.
- `RangeGrid`/`RangeCell` — solver-grade table: frequency mini-bars (gold=raise, green=call, muted=fold), rank
  headers, focus rings (`selected` 2px gold border), `accessibilityLabel` per cell.

## Premium qualities
- **Hierarchy + density** tuned for a desktop solver workspace (multi-panel, compact grid, inspector panel).
- **Micro-interactions** ≤200ms, interruptible, spring press via `PressableScale`; **no native driver on web**
  (avoids RN-web warnings); list/grid stagger native-only.
- **Reduced motion respected unconditionally** across the new primitives (HoverCard has none; DetailSheet flips;
  workspace relies on `useReducedMotion`).
- **Accessibility:** keyboard focus opens the inspector (HoverCard `onFocus`); cells have a11y labels; contrast
  via tokens; color never the sole signal (labels + % accompany the frequency bars).

## Web vs mobile (consistent, not identical)
Same design language + view-model; web = hover + side-by-side SplitPane; mobile = tap + bottom sheet. One render
component (`InspectorBody`) shared across web hover, the desktop panel, and the mobile sheet.

## Production-visible changes
**None this phase.** The `solver` flag is OFF in prod, so the workspace + entry don't render; the new shared
primitives (HoverCard/DetailSheet/SplitPane) are not yet used by any always-on screen. `prod-visible-changes.md`
is unchanged. (When `solver` flips ON, the workspace becomes visible — logged at that time.)

## Follow-ups (web polish, noted not blocking)
Arrow-key grid navigation; CSS `position: sticky` headers on web; an enforcing CSP (security) once tuned.
