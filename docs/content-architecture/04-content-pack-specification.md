# 04 — Content Pack Specification

**Deliverable 4.** The content-pack format, the **local-bundle-vs-server** delivery split (hybrid), **premium
content gating**, the on-device cache, and the **future update strategy**.

---

## 1. What a pack is
A `ContentPack` ([03](03-json-schema-specification.md)) is the **unit of delivery, versioning, and gating**. One
pack = one purchasable/gateable bundle of related content (e.g., "Cash 6-max Core", "MTT Final Tables"). A pack
may carry any mix of ranges, lessons, quizzes, paths, and (server-only) knowledge.

### Manifest fields that drive delivery/gating
| Field | Role |
|-------|------|
| `id` | Stable identity across versions |
| `version` (semver) | Content version → triggers re-download |
| `schemaVersion` | Structure version → triggers migration |
| `entitlements: PremiumFeatureKey[]` | Gating; `[]` = free |
| `minAppVersion` | Skip on older apps that can't render it |
| `checksum` / `signature` | Integrity on download |
| `isIllustrative` | Show the "training data" disclaimer (mirrors today's UI note) |

## 2. Delivery — hybrid (confirmed)

| Tier | Where | When | Offline |
|------|-------|------|---------|
| **Free starter** | **Bundled** in the app (today's `STARTER_DATASET`, re-expressed as a free `ContentPack`) | Always present | ✅ Always |
| **Commercial packs** | **Server-delivered** via `GET /api/content/index` + signed download, then **cached** | On demand, when entitled | ✅ After first download |

Rationale: the free tier guarantees an instant, offline first-run; commercial/large content stays out of the
binary (smaller app, updatable without releases, IP not shipped to every device). This matches the audit's
storage + transport seams.

### On-device cache (mirror `src/local/localGamesStore.ts`)
- Storage key `tpoker.content.v1`; quarantine prefix `tpoker.content.quarantine.`.
- `loadFile → isValid → migrateToCurrent → quarantine-on-corrupt`; serialized writes via a write-queue.
- Cache holds **verified** pack versions only; a failed/corrupt download never replaces a good version.
- Bundled starter is read directly (not cached) and is the fallback when nothing else is available.

```jsonc
// tpoker.content.v1 (illustrative shape)
{
  "schemaVersion": 1,
  "index": { "fetchedAt": "…", "packs": [ { "id": "…", "version": "1.2.0", "entitlements": ["advanced_gto"] } ] },
  "installed": { "gto-cash-6max-core": { "version": "1.2.0", "checksum": "sha256:…", "at": "…" } }
}
```

## 3. Premium content gating

- A pack declares the entitlements required to **access** it (`manifest.entitlements`). `[]` = free.
- The server gates **at two layers** (defense in depth): the index marks/omits packs the caller can't access,
  and the per-pack download re-checks entitlement before issuing a signed URL.
- The client composes the existing primitive — `EntitlementsContext.has(entitlement)` (fail-closed,
  `src/context/EntitlementsContext.tsx`) — into a content-level hook:

```ts
// shape only — future
function useContentAccess(packId: string): { allowed: boolean; reason?: 'locked' | 'unknown_pack' } {
  const { has } = useEntitlements();
  const pack = useContent().index.find(p => p.id === packId);
  if (!pack) return { allowed: false, reason: 'unknown_pack' };
  const allowed = pack.entitlements.length === 0 || pack.entitlements.every(e => has(e as Entitlement));
  return allowed ? { allowed: true } : { allowed: false, reason: 'locked' };
}
```

- UI reuses `<PremiumGate entitlement="advanced_gto">` / `premium_learning` to wrap locked content and surface
  the upgrade path (behind the existing `paywall` flag).
- **Free starter is never gated** — guests always have a working Study experience.
- Gating is **access/visibility**, not security for the bytes: true protection comes from the server only
  issuing download URLs to entitled users (commercial content is never bundled).

## 4. Bundle vs server — decision matrix
| | Bundled | Server-delivered |
|---|---|---|
| App size | grows | flat |
| Update cadence | app releases | server (instant) |
| Offline | always | after first fetch |
| IP exposure | in binary | controlled |
| Use for | small free starter | all commercial/premium |

## 5. Future update strategy
- **Poll the index** cheaply on Study-tab focus (rate-limited), compare `version` per pack.
- **Lazy download**: fetch a pack only when entitled, stale/missing, and about to be used.
- **Immutable versions**: each `version` is a distinct object; swap is atomic; stale reads impossible.
- **Verify before swap**: checksum (+ optional signature) must pass; else keep the prior good version + quarantine.
- **Rollback**: server repoints the index to a prior version; clients converge on next poll — no app release.
- **`minAppVersion`** lets new content require new app capabilities; older apps skip it (forward-compatible).
- **Migrations**: a `schemaVersion` bump runs the on-load migration chain, identical in spirit to
  `migrateToCurrent()` in the existing stores.

## 6. Out of scope here
No endpoints, cache module, or hook are implemented in this task — these are specifications for a future,
flag-gated phase ([06](06-migration-plan.md)). The `entitlements` strings reference the existing
`PremiumFeatureKey` union; no new keys are required for the initial commercial packs (`advanced_gto`,
`premium_learning` already exist).
