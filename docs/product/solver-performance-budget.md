# Solver Performance Budget + Rendering Strategy (Deliverable G)

> **Status: budget defined; core mitigations already in code.** Keeps the workspace fast as packs grow.

## Budgets
| Surface | Budget |
|---------|--------|
| Range grid interaction (hover/select) | < 16ms/frame (60fps); no full-grid re-render on a single-cell hover/select |
| Range grid initial render | 169 cells — cheap; render synchronously |
| Range / node lists (pickers, tree, search results) | virtualize when > ~50 items |
| Compare mode | cap to 2 ranges (baseline + 1) for the inline diff; bulk diff is on-demand |
| Pack import / hash | pure + O(content); validation is single-pass; large packs lazy-loaded from store |

## Mitigations (in code)
- **`RangeCell` is `React.memo`** — a cell re-renders only when its own `hand`/`mix`/`selected` props change. The
  hover popover state lives in `HoverCard` (per-cell), so hovering one cell does **not** re-render the grid.
- **Selection** is a single `selectedHand` string in the screen; only the previously- and newly-selected cells'
  `selected` prop changes ⇒ only those 2 cells re-render.
- **Inspector view-model** is a pure function (`buildInspectorView`) — cheap; computed for the focused hand only.
- **Compare diff** (`diffRanges`) is pure; the inline inspector computes a single-hand delta (O(1)-ish), not the
  full grid, on hover.
- **Pure logic** (combos/compare/inspector/grid/hash/validate) has no React overhead and is unit-tested.

## Strategy as data scales
- **Large packs / postflop nodes:** lazy-load pack bodies from `solverPackStore`; virtualize the (future) tree
  + node/range lists (`FlatList`/windowing) once > ~50 rows; memoize node→range lookups.
- **Many ranges:** the range picker is a horizontal list today; switch to a virtualized/searchable picker
  (ties into Global Search) when pack counts grow.
- **Web:** avoid layout thrash — fixed cell sizes, `transform`-based motion only, no per-frame layout reads.

## Proof
`RangeCell` memoization + local hover state are structural (verified by code review); the pure logic is covered
by `features/solver/logic/__tests__`. A render-count regression test is a noted follow-up (needs RTL setup).
