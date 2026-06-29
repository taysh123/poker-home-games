# Global Search Architecture (Deliverable M)

> **Design-only; additive, flag-gated, vendor-neutral.** A unified search over the canonical pack data. Starts
> client-side (no infra), with a documented server-search path for scale.

## Searchable entities
spots · boards (future postflop) · positions · stack depths · ranges (and, later, public spots + content).

## Index model (client-side, now)
A pure indexer builds a lightweight in-memory index from imported packs + illustrative ranges + saved spots:
```
SearchDoc { id; kind: 'range' | 'spot' | 'node'; label; packId?; tier;
            facets: { position?, stackBb?, scenario?, format?, street?, tags[] };
            text }   // tokenized label + facets
query(text, facets) → ranked SearchDoc[]   // pure; token match + facet filter + tier/popularity boost
```
- Built from the same canonical data the workspace uses (single source of truth).
- Facet filters (position / stack depth / scenario / street) compose with free-text.
- Pure + unit-testable (mirrors `logic/*`); memoized per pack set.

## Server-search path (future, scale)
When pack/public-spot volume outgrows the client index: a server endpoint (`GET /api/search`) over an indexed
store, same `SearchDoc` shape + query contract, so the client swaps the index source with no UI change. Behind
a flag; not built (infra dependency).

## Gating + honesty
Flag-gated; searches only over data that exists (no fabricated results); tier labels carried into results so
illustrative vs solver is always clear.
