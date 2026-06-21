/**
 * Pack catalog ingest integration (PR #6) — proves the bundled FK pair (pack_manifests +
 * premium_content_catalog) flows through the real ContentStore: validate (incl. content_hash + the
 * pack_manifests.PackID → Premium_Content_Catalog hard FK) → ingest WITHOUT quarantine → query → join.
 * This is the contract PackCatalogScreen relies on.
 */
import { createContentStore } from '../../../../content/contentStore';
import { createMemoryBackend } from '../../../../content/memoryBackend';
import { tableNameFor, type ContentPack } from '../../../../content/types';
import { buildPackCatalog } from '../../logic/marketableLabel';

const manifestsPack = require('../../../../../assets/content/0.8.1/pack_manifests.pack.json') as ContentPack;
const catalogPack = require('../../../../../assets/content/0.8.1/premium_content_catalog.pack.json') as ContentPack;

describe('bundled pack pair → ContentStore → pack catalog', () => {
  it('ingests the FK pair WITHOUT quarantine (hard FK resolves in one set)', async () => {
    const store = createContentStore(createMemoryBackend());
    // Order intentionally manifest-first to prove FK resolution is order-independent.
    const results = await store.ingest([manifestsPack, catalogPack]);
    expect(store.quarantine()).toEqual([]);
    expect(results.every(r => r.ok && !r.quarantined)).toBe(true);
    expect(results.map(r => r.table).sort()).toEqual(['pack_manifests', 'premium_content_catalog']);
  });

  it('a lone manifest (FK dangling) quarantines — proving the pair must ship together', async () => {
    const store = createContentStore(createMemoryBackend());
    const results = await store.ingest([manifestsPack]);
    expect(results[0]).toMatchObject({ ok: false, quarantined: true });
    expect(store.quarantine()[0].reason).toBe('foreign_key');
  });

  it('queries both tables and joins into the catalog', async () => {
    const store = createContentStore(createMemoryBackend());
    await store.ingest([manifestsPack, catalogPack]);

    const manifests = await store.getAll(tableNameFor(manifestsPack.manifest.source_sheet));
    const catalog = await store.getAll(tableNameFor(catalogPack.manifest.source_sheet));
    expect(manifests.length).toBe(manifestsPack.manifest.row_count);
    expect(catalog.length).toBe(catalogPack.manifest.row_count);

    const packs = buildPackCatalog(manifests, catalog);
    expect(packs.length).toBe(manifests.length);
    for (const p of packs) {
      expect(p.id).toMatch(/^PACK-/);
      expect(p.marketableAs.length).toBeGreaterThan(0);
    }
    // The honesty gate holds against store-sourced rows too.
    expect(packs.every(p => p.verifiedBadge === (p.pctVerifiedOrNash >= 95))).toBe(true);
  });
});
