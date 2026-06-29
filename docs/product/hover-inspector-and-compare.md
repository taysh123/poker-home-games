# Hover Inspector + Compare Mode (Deliverable E)

> **Status: built, honest.** The inspector shows only truthful fields; EV/equity appear ONLY when present in an
> imported pack. The honesty gate is a pure, unit-tested view-model (`logic/inspector.ts`).

## The honesty gate — `buildInspectorView(range, hand, opts)`
Pure function → `InspectorView`. Single place that decides what's shown:
| Field | Source | Always shown? |
|-------|--------|---------------|
| action frequency % | `ActionFrequency.freq` | ✅ always (real) |
| sizing (bb) | `ActionFrequency.sizeBb` | when present |
| **combo count** | derived combinatorics (`logic/combos.ts`: pair 6 / suited 4 / offsuit 12) | ✅ always (math, not solver) |
| position / stack / scenario | range fields | ✅ always |
| node breadcrumb | node path or `[scenario, position]` fallback | ✅ always |
| verification tier label | pack/range tier (`solver`/`calibrated`/`illustrative`) | ✅ always |
| **EV (bb)** | `ActionFrequency.evBb` | **only if present** — never fabricated |
| **equity** | `ActionFrequency.equity` | **only if present** — never fabricated |
| compare delta | `compareTo` range | when compare is on |

When no EV/equity is present (`hasSolverData === false`) the inspector shows the note *"Frequencies shown;
EV/equity appear only in imported solver packs."* — so the user is never misled about illustrative data.

## Compare mode — `logic/compare.ts`
`diffRanges(base, other)` → per-hand max frequency delta, sorted by magnitude (pure). The inspector surfaces
`Δ vs <other.label>: N%` for the focused hand; the grid can tint by delta. No fabrication — it only diffs the
frequencies that exist.

## Mobile fallback
Identical view-model; rendered in a `DetailSheet` (bottom sheet) on tap instead of a hover popover. The render
component (`HandInspector.InspectorBody`) is shared between web hover, the desktop inspector panel, and the
mobile sheet — one source of truth.

## Tests (`features/solver/logic/__tests__/solverLogic.test.ts`)
Real frequencies + derived combos shown; **EV/equity undefined when absent, present when in the data**; tier
labelled; pure-fold hand marked not-in-range; compare delta computed. Plus combos + diff + grid-mapping tests.

## Remaining data dependency
Rich solver depth (EV/equity/node-tree) lights up automatically when a verified pack is imported via the
canonical pipeline — see `solver-pack-architecture.md` / `solver-import-pipeline.md`. The exact external solver
export format for a concrete adapter is an external dependency (ask, don't invent).
