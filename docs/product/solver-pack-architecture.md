# Solver Pack Architecture (Deliverable B)

> **Status: built (canonical format + types + hashing + validation).** Vendor-neutral; additive; flag-gated
> downstream (`solver` OFF in prod). No production change. The only sample data is a **test-only fixture**
> (`pack/__fixtures__/`), never shipped or shown to users. **No fabricated solver values.**

## Why a T-Poker-owned canonical format
T Poker owns the canonical solver representation rather than depending on any one vendor. External solvers
(GTO Wizard / PioSolver / GTO+ / Monker / custom) convert **into** this format via adapters; everything
downstream (workspace, hover inspector, compare, future tree viewer, search) consumes only the canonical
`SolverPack`. This decouples the product from any single solver's export shape.

## Files (`apps/poker-mobile/src/features/solver/pack/`)
| File | Role |
|------|------|
| `types.ts` | Canonical `SolverPack`/`SolverPackManifest`/`SolverRange`/`SolverNode` + `VerificationTier`/`Street` |
| `hash.ts` | Stable canonical JSON + 32-bit FNV-1a content checksum (integrity, not signature; pure/deterministic) |
| `validate.ts` | Pure fail-closed validation (schema/enums/ranges/tree-integrity/hash) |
| `adapters.ts` | `SolverAdapter` seam + `identityAdapter` (passthrough); registry + `selectAdapter` |
| `importPack.ts` | `prepareImport` — pure pipeline (adapter→validate), no storage |
| `../data/solverPackStore.ts` | AsyncStorage persistence + quarantine + promote |

## Canonical model
- **`SolverPackManifest`**: `id`, `name`, `schemaVersion` (=1), `verificationTier` (`solver`|`calibrated`|`illustrative`), `contentHash`, `importedAt`; optional `importVersion`, `sourceSolver`/`sourceVersion`, scenario/format/tableSize/stackBb/positions, `baselinePackId` (compare lineage), and **verification provenance** `verifiedBy`/`verifiedAt`/`solverEngine`/`solverVersion`.
- **`SolverRange`** = study `PreflopRange` + optional `verificationTier` + `nodeRefs[]`. The per-action `ActionFrequency` (in `study/types.ts`) gained additive optional `evBb?`/`equity?` — present **only** in verified packs.
- **`SolverNode`** (future tree viewer): `id`, `path[]` (breadcrumb), `street`, `parentId?`, `rangeId?` — the range↔node relationship.

## Versioning + integrity
- `schemaVersion` gates structural compatibility (validation rejects unsupported versions). `importVersion` tracks pipeline changes. `manifest.version`-style content semver can ride in `sourceVersion`/pack id conventions.
- `contentHash` = FNV-1a over canonical JSON of `{ manifest-without-contentHash, ranges, nodes }`. Deterministic + key-order-independent ⇒ detects corruption/tampering. Documented as an **integrity checksum**, swappable for SHA-256 (expo-crypto) if cryptographic integrity is later required.

## Verification tiers (honesty)
`solver` (verified solver output) · `calibrated` (human-tuned, solver-informed) · `illustrative` (educational, not solver-verified — today's bundled study ranges). The tier is surfaced in the inspector so users always know what they're looking at. EV/equity render only when truly present.

## Additive + safe
Every new field is optional; the study range model and its tests are unchanged. No EF/DB migration (client-side packs). Flags OFF ⇒ none of this surfaces ⇒ production byte-identical.
