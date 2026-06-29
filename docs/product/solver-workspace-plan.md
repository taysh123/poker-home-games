# Solver Workspace (Deliverable D)

> **Status: built, flag-gated (`solver` OFF in prod ⇒ byte-identical).** Web-responsive surfaces inside the
> existing Expo app (no separate stack). Consumes the canonical solver-pack (or the bundled illustrative study
> ranges, labelled). No fabricated solver values.

## Surfaces (`apps/poker-mobile/src/features/solver/`)
| File | Role |
|------|------|
| `ui/SolverWorkspaceScreen.tsx` | Desktop multi-panel (SplitPane: grid + inspector) / mobile single-column + bottom-sheet; range picker + compare picker + saved-spot action |
| `ui/RangeGrid.tsx` + `logic/grid.ts` | 13×13 grid (pure `handAt` mapping), rank headers, web hover inspector per cell (focus-accessible), mobile tap → sheet |
| `ui/RangeCell.tsx` | Memoized cell (frequency bars) — re-renders only on its own prop change (perf budget) |
| `ui/HandInspector.tsx` | Thin renderer of the inspector view-model |
| `state/SolverContext.tsx` | Loads imported packs + illustrative ranges + private saved spots (fail-soft) |
| `data/savedSpotsStore.ts` | Private saved spots/bookmarks (AsyncStorage, quarantine-never-lose) |

## Responsive primitives (reusable, `src/`)
- `hooks/useResponsive.ts` — `breakpointFor` (pure, tested) + the hook (mobile <768 / tablet / desktop ≥1024).
- `components/HoverCard.tsx` — web hover/focus popover; **mobile passthrough**.
- `components/DetailSheet.tsx` — mobile bottom-sheet (reduced-motion-safe).
- `components/SplitPane.tsx` — side-by-side on desktop/tablet, stacked on mobile.

## Interaction model
- **Web:** hover (or Tab-focus) a cell ⇒ `HoverCard` shows the inspector; the grid + inspector sit side-by-side (`SplitPane`).
- **Mobile:** tap a cell ⇒ `DetailSheet` shows the inspector.
- **Compare:** pick a second range ⇒ each inspector shows the per-hand frequency delta vs the baseline.
- **Saved spots:** ★ Save records a private bookmark (range + hand) locally.
- **Accessibility:** cells are focusable Pressables with `accessibilityLabel`; hover popover also opens on focus (keyboard); reduced-motion respected by the sheet + primitives.

## Entry points
- Deep link `/solver` (web) via the navigation `linking` config — **resolves only when the `solver` flag registers the screen** (OFF ⇒ route inert ⇒ byte-identical).
- A flag-gated "Solver Workspace" card at the top of the Study screen.
- (Flip-time) a prominent web nav entry/tab is added when `solver` goes ON — a one-line nav change.

## Known follow-ups (web polish)
- Arrow-key grid navigation (Tab/focus works today; arrow movement is a web enhancement).
- CSS `position: sticky` headers on web (headers are the first row/col today; fine for the 13×13 grid).
- These are noted in `solver-performance-budget.md` / the design audit; none block the core workspace.
