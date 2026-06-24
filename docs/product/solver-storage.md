# Solver Storage (design-only)

> **Design-only; additive, flag-gated, no fabricated data, no assumed rights.** Describes how canonical solver
> packs are stored, versioned, and delivered. The current client store is built; the optional server catalog is
> design-only and needs a schema + migration designed SEPARATELY (NOT here). Reuses the existing entitlement seam
> for free-vs-premium packs. Nothing surfaces while `solver` is OFF ⇒ production byte-identical. Canonical model:
> `solver-pack-architecture.md`; import flow: `solver-import-pipeline.md`.

## Current state — client store (BUILT)
`features/solver/data/solverPackStore.ts` over AsyncStorage, mirroring `local/localGamesStore.ts`:
- **Key:** `tpoker.solverPacks.v1`; store file is `{ schemaVersion: 1, packs: SolverPack[] }`.
- **Quarantine-never-lose:** a corrupt store file OR an import that fails the pipeline is copied to
  `tpoker.solverPacks.quarantine.<ts>-<rand>` and never silently dropped (the live set is never lost).
- **Content-hash identity:** every pack carries `manifest.contentHash` (FNV-1a over canonical JSON of
  manifest-sans-hash + ranges + nodes — `pack/hash.ts`). Deterministic + key-order-independent ⇒ corruption is
  detectable and re-imports are idempotent.
- **Promote / replace:** `importAndStore` promotes only a pack that passes `prepareImport` (adapter → validate →
  hash), replacing any same-`manifest.id` pack. Fail-closed: invalid input never reaches the live set.

## Versioning model (canonical, already defined)
- `schemaVersion` (=1) gates **structural** compatibility — validation rejects unsupported versions.
- `importVersion` tracks **pipeline/adapter** changes.
- Source/content lineage rides in `sourceSolver`/`sourceVersion` + the pack-id convention; `baselinePackId` links
  a compare baseline. Same content ⇒ same `contentHash` ⇒ updates are detectable. No vendor format is assumed.
- **Upgrade in place:** importing a newer export of the same `manifest.id` replaces the old pack (a different
  `contentHash` ⇒ a detected update); a re-import of identical content is a no-op (same hash). Multiple distinct
  packs (different ids) coexist in the store file. None of this needs a server or a migration today.

## Entitlement (reuse the existing seam — do NOT bypass)
Free-vs-premium packs gate through the **existing entitlement seam** (the same `AiCreditPolicy`/tier seam the
coach uses in `features/coach/config.ts` + `features/premium/config`). A pack is tagged free/premium in product
config; the workspace checks entitlement before loading a premium pack. The store itself stays
entitlement-agnostic (it persists what it's given) — gating is a layer above, exactly like coach enforcement sits
above the provider. No new bypass path.

## Delivery — bundled vs server (trade-offs)
| | **Bundled in-app asset** | **Server-delivered (future, gated)** |
|---|---|---|
| Update cadence | Ship an app/web build | Update server-side, no app release |
| Size cost | Inflates the bundle | Lazy-load on demand |
| Offline | Always available | Needs network on first fetch |
| Entitlement | Static at build time | Checked per request server-side |
| Security headers | None | **CSP `connect-src`** must include the origin |
| Backend work | None | Endpoint + entitlement check + (see below) catalog schema |

Either way the bytes land in `solverPackStore` and flow through the **same** validate/quarantine/promote
pipeline — delivery is orthogonal to the canonical contract.

## Future: optional server catalog (DESIGN-ONLY, gated)
If packs become server entities (a catalog with versioning/entitlement rows, provenance/audit), that requires an
**EF schema + migration designed SEPARATELY** — explicitly NOT designed in this doc, matching the decision point
in `solver-flip-readiness-checklist.md` §2. Client-side packs need **no** EF migration. When/if built:
- New tables (catalog, version, entitlement-grant rows) + a delivery endpoint with an entitlement check reusing
  the existing seam.
- `connect-src` for the pack origin added to the CSP, moved from report-only → enforcing once the report stream
  is clean (`web-security-headers.md`).
- Optional signed provenance (today's `contentHash` is an integrity checksum, swappable for SHA-256 via
  expo-crypto if cryptographic integrity is required).

## CSP note (server-delivered only)
The moment packs load from a new origin (server/CDN), add that origin to `connect-src` in the security headers
before flipping the CSP to enforcing. Bundled delivery needs no CSP change.

## Honesty + rollback
- Tiers are stored verbatim from the pack (`solver`/`calibrated`/`illustrative`) and never upgraded; the
  inspector surfaces the tier and shows EV/equity only when present.
- Rollback = flip `solver` OFF / remove the pack; the store quarantines bad data and never loses the live set.

## Cross-links
`solver-pack-architecture.md` · `solver-import-pipeline.md` · `solver-flip-readiness-checklist.md` ·
`public-spot-library-architecture.md` · `web-first-final-report.md` (K).
