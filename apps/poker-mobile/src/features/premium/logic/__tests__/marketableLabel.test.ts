/**
 * Pack catalog logic tests (PR #6). Drives the truth table off the REAL bundled packs (17), proving the
 * MarketableAs/verification-tier display, the ≥95% GTO/Verified honesty gate, Expert-Calibrated passthrough,
 * and the fail-closed locked/unlocked availability matrix. Plus synthetic edge-case units.
 */
import {
  buildPackCatalog,
  normalizePack,
  accessClassOf,
  availabilityOf,
  isOpenable,
  isVerified,
  parsePct,
  packById,
  GTO_VERIFIED_THRESHOLD,
  type Pack,
} from '../marketableLabel';
import type { Row } from '../../../../content/types';

const manifests = (require('../../../../../assets/content/0.8.1/pack_manifests.pack.json') as { rows: Row[] }).rows;
const catalog = (require('../../../../../assets/content/0.8.1/premium_content_catalog.pack.json') as { rows: Row[] }).rows;

describe('parsePct', () => {
  it('parses numbers and numeric strings; non-numeric → 0', () => {
    expect(parsePct(100)).toBe(100);
    expect(parsePct('9.2')).toBe(9.2);
    expect(parsePct('0')).toBe(0);
    expect(parsePct('')).toBe(0);
    expect(parsePct(null)).toBe(0);
    expect(parsePct('n/a')).toBe(0);
  });
});

describe('isVerified — the GTO/Verified honesty gate', () => {
  it(`is true only at ≥ ${GTO_VERIFIED_THRESHOLD}`, () => {
    expect(isVerified(95)).toBe(true);
    expect(isVerified(100)).toBe(true);
    expect(isVerified(94.9)).toBe(false);
    expect(isVerified(0)).toBe(false);
  });
});

describe('accessClassOf — fail-closed', () => {
  it('maps known tiers', () => {
    expect(accessClassOf('Free + Premium')).toBe('free_plus_premium');
    expect(accessClassOf('Premium')).toBe('premium');
    expect(accessClassOf('Free')).toBe('free');
    expect(accessClassOf('Future Pack')).toBe('coming_soon');
  });
  it('treats unknown/empty as premium (never silently exposes)', () => {
    expect(accessClassOf('mystery')).toBe('premium');
    expect(accessClassOf('')).toBe('premium');
    expect(accessClassOf(null)).toBe('premium');
  });
});

describe('availabilityOf — locked/unlocked matrix (fail-closed)', () => {
  const mk = (accessClass: Pack['accessClass']): Pack =>
    ({ accessClass } as Pack);
  it('free + free_plus_premium are always available', () => {
    expect(availabilityOf(mk('free'), false)).toBe('available');
    expect(availabilityOf(mk('free_plus_premium'), false)).toBe('available');
  });
  it('premium is locked without entitlement, available with it', () => {
    expect(availabilityOf(mk('premium'), false)).toBe('locked');
    expect(availabilityOf(mk('premium'), true)).toBe('available');
  });
  it('coming_soon is never openable regardless of entitlement', () => {
    expect(availabilityOf(mk('coming_soon'), true)).toBe('coming_soon');
    expect(isOpenable(mk('coming_soon'), true)).toBe(false);
  });
});

describe('normalizePack', () => {
  it('returns null without a PackID', () => {
    expect(normalizePack({ PackName: 'x' } as Row, undefined)).toBeNull();
  });
  it('a Future-tier pack is coming_soon even if FreeOrPremium is mislabeled Premium (defense in depth)', () => {
    const p = normalizePack(
      { PackID: 'PF', PackName: 'Future', Tier: 'Future', MarketableAs: 'Curriculum', PctVerifiedOrNash: '0' } as Row,
      { PackID: 'PF', FreeOrPremium: 'Premium' } as Row, // editor mistake: a future pack marked Premium
    )!;
    expect(p.accessClass).toBe('coming_soon');
    expect(availabilityOf(p, true)).toBe('coming_soon'); // never buyable/openable
  });

  it('joins manifest + catalog; missing catalog ⇒ fail-closed premium, verbatim MarketableAs', () => {
    const p = normalizePack(
      { PackID: 'P9', PackName: 'Test', Tier: 'Pro', MarketableAs: 'Expert Calibrated', PctVerifiedOrNash: '0', SourceSheets: 'A; B' } as Row,
      undefined,
    )!;
    expect(p.id).toBe('P9');
    expect(p.marketableAs).toBe('Expert Calibrated'); // verbatim
    expect(p.verifiedBadge).toBe(false);
    expect(p.accessClass).toBe('premium'); // no catalog row ⇒ fail-closed
    expect(p.sourceSheets).toEqual(['A', 'B']);
  });
});

describe('buildPackCatalog — real 17-pack truth table', () => {
  const packs = buildPackCatalog(manifests, catalog);

  it('builds all 17 packs, sorted by id', () => {
    expect(packs.length).toBe(17);
    expect(packs.map(p => p.id)).toEqual([...packs.map(p => p.id)].sort());
  });

  it('packById finds a pack (detail screen) and returns null for unknown', () => {
    expect(packById(packs, packs[0].id)).toBe(packs[0]);
    expect(packById(packs, 'PACK-NOPE')).toBeNull();
  });

  it('GTO/Verified treatment is granted to EXACTLY the ≥95% packs (honesty gate)', () => {
    const verified = packs.filter(p => p.verifiedBadge);
    // Only PACK-05 (100%) qualifies in 0.8.1; every other pack is below the threshold.
    expect(verified.map(p => p.id)).toEqual(['PACK-05']);
    for (const p of packs) {
      expect(p.verifiedBadge).toBe(p.pctVerifiedOrNash >= GTO_VERIFIED_THRESHOLD);
      if (p.verifiedBadge) expect(p.tierBadge).toBe('gto_verified');
    }
  });

  it('MarketableAs is shown verbatim (no synthesis) and maps to a tier badge', () => {
    for (const p of packs) {
      expect(p.marketableAs.length).toBeGreaterThan(0);
      if (p.marketableAs === 'Expert Calibrated') expect(p.tierBadge).toBe('expert_calibrated');
      if (p.marketableAs === 'Curriculum') expect(p.tierBadge).toBe('curriculum');
    }
  });

  it('availability matrix matches the bundled access tiers (free user vs premium user)', () => {
    const free = new Map(packs.map(p => [p.id, availabilityOf(p, false)]));
    const prem = new Map(packs.map(p => [p.id, availabilityOf(p, true)]));
    for (const p of packs) {
      if (p.accessClass === 'coming_soon') {
        expect(free.get(p.id)).toBe('coming_soon');
        expect(prem.get(p.id)).toBe('coming_soon');
      } else if (p.accessClass === 'premium') {
        expect(free.get(p.id)).toBe('locked');
        expect(prem.get(p.id)).toBe('available');
      } else {
        expect(free.get(p.id)).toBe('available'); // free / free_plus_premium
        expect(prem.get(p.id)).toBe('available');
      }
    }
    // Sanity: the bundled data has at least one of each interesting state.
    expect([...free.values()]).toContain('locked');
    expect([...free.values()]).toContain('available');
    expect([...free.values()]).toContain('coming_soon');
  });
});
