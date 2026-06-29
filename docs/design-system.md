# T Poker Design System

The shared visual + motion language for the app. Goal: one premium, calm, consistent product across every
surface (production + V2 content). This is the spec the polish program builds to; it is reviewed before the
primitives are built.

## Principles
- **Tokens only** — never hardcode hex / font-size / spacing in screens. Use `theme/{colors,typography,spacing,radii,shadows,motion}`.
- **Gold is sparing** — primary CTAs, live indicators, key money/verified signals only. Overuse degrades premium feel.
- **Calm motion** — deliberate, not flashy; 150–300ms; respects `prefers-reduced-motion`; web-safe.
- **One way to do a thing** — a single primitive per pattern (chip, list row, state view) instead of per-screen re-rolls.

## Tokens (existing — source of truth)
`colors.ts` (surface/gold/text/semantic + gradients), `typography.ts` (display/h1–h4/body/label/caps/amount,
3-face Inter+Sora+DM Serif), `spacing.ts` (4pt: xs4 sm8 md12 lg16 xl20 xxl24 xxxl32 huge40), `radii.ts`
(sm10 md14 lg16 xl20 pill), `shadows.ts` (sm/md/lg/xl + gold/error), `motion.ts` (durations
instant80/fast150/normal250/slow400 + easings + helpers). **Gaps to fill:** semantic doc (this file); ensure
`AppTextInput` uses tokens (currently hardcoded 12/14/16).

## Components

### New primitives (`src/components/`)
**`Chip`** — the single small-label primitive (replaces 5+ hand-rolled chips). `Badge.tsx` is **dead code**
(zero importers — verified) and is **deleted** when Chip lands; prod list pills live inline in
`SessionListItem`/`GroupListItem` and are migrated to Chip in Phase 3 (measured, prod-visible).
```ts
type ChipTone = 'neutral' | 'gold' | 'success' | 'error' | 'warning' | 'info';
interface ChipProps { label: string; tone?: ChipTone; size?: 'sm'|'md'; icon?: IoniconName;
  solid?: boolean; dot?: boolean; style?: ViewStyle; } // default tone 'neutral', size 'sm', solid false
```
- Geometry pinned to measured values so adoption is byte-near: **sm** = `{ fontSize 10, padH spacing.sm(8),
  padV 2, radius radii.sm }`, **md** = `{ fontSize 11, padH 10, padV 3 }`.
- Tones map to token bg/border/text pairs. `solid` = filled accent (e.g. gold verified badge) AND auto-flips
  icon+text to the on-accent color (`colors.background`) so a gold-on-gold icon can't go invisible. `dot` =
  leading status dot. (No `premium` tone — use `tone="gold" solid` to keep one way to do it.)

**`ErrorState`** — ALREADY EXISTS (`src/components/ErrorState.tsx`, V2.1 STEP 4.1): `{ title?, message?,
onRetry? }`, standalone with a retry button. **Reuse it** (do not add a competitor). The fix is adoption: the
surfaces that fake errors with `EmptyState`/inline red text migrate to `ErrorState` (Phase 2). `StateView`'s
error branch renders it.

**`StateView`** — collapses the `error ? : loading ? : empty ? : list` ladder every list re-implements.
```ts
interface StateViewProps { loading: boolean; error?: boolean | { title?: string; subtitle?: string };
  isEmpty: boolean; skeleton?: ReactNode; empty: ReactNode; onRetry?: () => void; children: ReactNode; }
```
Precedence **error → loading → empty → children** (matches existing screens, which test `error` first).
Default skeleton = 4 `SkeletonRow`. `error` accepts a `{title,subtitle}` for richer messages later.

**`ListRow`** — the icon + title + meta + chips row (Lesson modules, Pack rows, Coach methods/history).
```ts
interface ListRowProps { icon?: IoniconName; iconColor?: string; title: string; titleLines?: number;
  titleRight?: ReactNode; subtitle?: string; chips?: ReactNode; onPress?: () => void;
  disabled?: boolean; dim?: boolean; }
```
Layout (matches PackRow's real 3-row shape): **row 1** = title (left, `titleLines` default 1) + `titleRight`
(inline trailing — chevron default when `onPress`; or lock/SOON); **row 2** = `subtitle`/meta; **row 3** =
`chips`. Explicit `titleRight` overrides the chevron default. Wraps `Card` + `PressableScale`; `dim` =
coming-soon (opacity).

**Stat:** do NOT add a new component — reuse the existing shared `StatWidget`
(`{label,value,sub?,icon?,ionicon?,valueColor?,accentColor?,delay?}`). StudyScreen's local `Stat` migrates to
`StatWidget` in Phase 2.

### Refined shared primitives (prod-visible — log each in `docs/release/prod-visible-changes.md`)
**Phase 1 (low-risk, additive/a11y — no geometry change to prod forms):**
- `EmptyState` — minor token cleanup (use `radii.xl` for the icon circle); `ErrorState` builds on it.
- `SkeletonRow` — fix the spacing **mechanism** (it uses an internal `borderTop`; loaded lists space via parent
  `gap`). Align the mechanism so skeleton rhythm matches the loaded list — do NOT just add a bottom gap (that
  double-spaces the screens that already use parent `gap`). Verify against StatsScreen + AllSessionsScreen.
- `PrimaryButton` — a11y/semantics ONLY (accessibilityRole/state, disabled semantics). **No geometry change**
  (its `radius 12 / minHeight 52 / padV 16` are deliberate non-token values on every prod CTA).
- `Badge.tsx` — **delete** (dead code, 0 importers).
**Deferred to Phase 3 (measured, geometry — high prod risk):**
- `AppTextInput` / `FormRow` token migration (current `12/14/16/1.5/radius12` are deliberate; snapping to
  tokens changes height/radius/label tracking on every auth+form screen) → measured migration with before/after,
  or add the in-between values as tokens rather than rounding.
- `Card` elevation/`pressable` and `ActionSheet`/modal motion → evaluate in Phase 3 (current `elevated` already
  uses `shadows.md`; low payoff, confirm a real deviation before changing).

## Motion conventions
- **Reduced motion:** use the existing `hooks/useReducedMotion.ts` for motion accessibility **unconditionally**
  (not gated by the `polish` flag). Concretely: `Celebration` currently checks `polish && reducedMotion` → change
  to just `reducedMotion`. **This is a prod behavior change** (a prod user with Reduce Motion ON will stop seeing
  end-game confetti — the correct outcome) → **log it in the ledger.** The change is **surgical**: only the
  motion gate moves; the other 4 `polish` sites (OfflineBanner, native date picker, BrandSplash skippable,
  HomeScreen re-anim guard) stay gated.
- **Screen entrance:** apply `Screen animated` (mount-once `FadeInDown` ~250ms, native-only; web = opacity only)
  to deep content screens that DON'T already use the focus-replay `useScreenEntrance` hook. **Never apply both**
  to the same screen (double animation). Tab/hub screens that re-animate on focus keep `useScreenEntrance`.
- **List stagger:** native-only entering with `stagger(index)` (~30–50ms/item, capped); web = none/opacity.
  First-paint note: `useReducedMotion` resolves async (defaults false), so one frame may animate before it flips.
- **Press:** `PressableScale` (spring 0.97 + light haptic native). **Success:** `Celebration`. **Skeleton:**
  `Shimmer` (sweep native / pulse web).
- **Micro-interactions:** quiz option select → brief scale/opacity on commit; segmented toggles → animated
  indicator. All ≤200ms, interruptible, reduced-motion-safe.

## Web vs native rules
Reanimated layout-animation `entering` props are native-only; web uses opacity/shared-value styles. `GlassView`
blur is iOS-only (solid fallback elsewhere). Haptics native-only. `Alert.alert` is a web no-op → use
`utils/confirm` + `utils/toast`.

## Accessibility
Touch targets ≥44×44; `accessibilityRole`/`accessibilityLabel` on all pressables; contrast ≥4.5:1 for body;
respect reduced motion; Dynamic Type tolerance (avoid clipping). Color never the sole signal (pair with icon/text).

## Adoption order
Phase 1 builds the primitives + motion layer (this spec). Phase 2 adopts them across content surfaces; Phase 3
across production surfaces (prod-visible, logged). Each step: tsc + jest + export + (prod) before/after note.
