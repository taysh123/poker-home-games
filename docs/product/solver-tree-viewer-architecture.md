# Solver Tree Viewer Architecture (Deliverable L)

> **Design-only.** Future node-tree navigation built on the canonical pack's `SolverNode` (already in
> `pack/types.ts`). Additive, flag-gated, vendor-neutral. No fabricated node/EV data.

## Node-tree model (already in the canonical pack)
`SolverNode { id, path[], street, parentId?, rangeId?, label? }`. A pack's `nodes[]` is a forest validated for
integrity (unique ids, resolvable `parentId`, no cycles, `rangeId`/`nodeRefs` resolve — see `validate.ts`). The
**range↔node** relationship: a node references the `SolverRange`/strategy that applies at that decision point;
the range's `nodeRefs[]` link back. So selecting a node drives the existing `RangeGrid` + `HandInspector`.

## Navigation model
- Root → street nodes (preflop/flop/turn/river) → action nodes; `path[]` is the breadcrumb the inspector already
  renders. A `useSolverTree(pack)` selector builds parent→children adjacency (memoized) from the flat `nodes[]`.
- Selecting a node sets `activeNodeId` → resolves `rangeId` → the grid shows that node's range; the breadcrumb
  shows `path`.

## Rendering strategy for large solves
- **Lazy expansion:** render only expanded nodes' children; collapse by default beyond the current path.
- **Virtualization:** windowed list/tree for wide levels (>~50 siblings).
- **Level-of-detail:** show summary (action + freq) at depth; full inspector on focus.
- **Perf-budgeted** per `solver-performance-budget.md` (memoized node rows; adjacency computed once per pack).

## Honesty + gating
Nodes render only from imported packs that pass validation; no synthetic tree is fabricated. Behind the `solver`
flag (and the tree viewer can be a sub-flag at build time). EV/equity at a node follow the same "present-only"
rule as the inspector.
