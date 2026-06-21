/**
 * Pack catalog logic (PR #6) — PURE, tested. Joins `Pack_Manifests` (verification rollups) with
 * `Premium_Content_Catalog` (access tier + metadata) by `PackID` into a typed `Pack`, and derives the
 * display label, verification-tier badge, and availability/lock state. No I/O, no React. Rows come from
 * the ContentStore (never the workbook).
 *
 * HONESTY GATE: `MarketableAs` is shown VERBATIM from the manifest, but the "GTO / Verified" visual
 * treatment (`verifiedBadge`) is only granted when `PctVerifiedOrNash ≥ 95` — defense-in-depth over the
 * exporter's own rule, so the app can never over-claim solver verification even if upstream data drifts.
 * Access classification is FAIL-CLOSED: an unrecognized `FreeOrPremium` is treated as premium (locked).
 */
import type { Row } from '../../../content/types';

/** Pct of member rows that are Nash-Solved or Solver-Verified required to earn the GTO/Verified treatment. */
export const GTO_VERIFIED_THRESHOLD = 95;

export type AccessClass = 'free' | 'free_plus_premium' | 'premium' | 'coming_soon';
export type PackAvailability = 'available' | 'locked' | 'coming_soon';
/** Drives badge styling; mirrors the verbatim MarketableAs families. */
export type TierBadge = 'gto_verified' | 'expert_calibrated' | 'curriculum' | 'educational' | 'other';

export interface Pack {
  id: string;
  name: string;
  tier: string; // Core / Pro / Elite / Future (verbatim)
  /** Verbatim MarketableAs from the manifest. Never synthesized. */
  marketableAs: string;
  pctVerifiedOrNash: number;
  readinessScore: number | null;
  sourceSheets: string[];
  rowCount: number | null;
  // From the catalog
  freeOrPremium: string; // verbatim
  difficulty: string;
  estimatedHours: string;
  status: string;
  // Derived
  accessClass: AccessClass;
  /** True only when pctVerifiedOrNash ≥ GTO_VERIFIED_THRESHOLD (the honesty gate). */
  verifiedBadge: boolean;
  tierBadge: TierBadge;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const trimmed = (v: unknown): string => str(v).trim();

/** Parse a numeric-ish cell ("0", "9.2", "100") → number; non-numeric → 0. */
export function parsePct(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(trimmed(v));
  return Number.isFinite(n) ? n : 0;
}

/** Map the catalog's FreeOrPremium to an access class. FAIL-CLOSED: unknown → premium (locked). */
export function accessClassOf(freeOrPremium: unknown): AccessClass {
  const s = trimmed(freeOrPremium).toLowerCase();
  if (s === 'future pack' || s === 'future' || s === 'coming soon') return 'coming_soon';
  if (s === 'free + premium' || s === 'free+premium' || s === 'free & premium') return 'free_plus_premium';
  if (s === 'free') return 'free';
  if (s === 'premium') return 'premium';
  return 'premium'; // unknown ⇒ treat as premium (never silently expose)
}

/** Whether the pack has earned the GTO/Verified treatment (the honesty gate). */
export function isVerified(pctVerifiedOrNash: number): boolean {
  return pctVerifiedOrNash >= GTO_VERIFIED_THRESHOLD;
}

function tierBadgeOf(marketableAs: string, verified: boolean): TierBadge {
  const s = marketableAs.toLowerCase();
  // Branch order is load-bearing: 'gto'/'verified' is checked first and, when not verified (pct<95),
  // degrades to 'expert_calibrated' — so a GTO-flavored label below the threshold never earns the gold badge.
  if (s.includes('gto') || s.includes('verified')) return verified ? 'gto_verified' : 'expert_calibrated';
  if (s.includes('calibrated')) return 'expert_calibrated';
  if (s.includes('curriculum')) return 'curriculum';
  if (s.includes('educational')) return 'educational';
  return 'other';
}

/** Join one manifest row with its catalog row (may be undefined) into a typed Pack, or null if no PackID. */
export function normalizePack(manifest: Row, catalog: Row | undefined): Pack | null {
  const id = trimmed(manifest.PackID);
  if (!id) return null;
  const pct = parsePct(manifest.PctVerifiedOrNash);
  const verified = isVerified(pct);
  const marketableAs = trimmed(manifest.MarketableAs);
  const readiness = trimmed(manifest.ReadinessScore);
  const rowCountRaw = trimmed(manifest.RowCount);
  const tier = trimmed(manifest.Tier) || trimmed(catalog?.Tier);
  // coming_soon is detected from EITHER signal (access tier OR a Future tier) so a mislabeled future pack
  // (e.g. FreeOrPremium set to "Premium" by mistake) can't become a buyable, empty (RowCount 0) pack.
  const access = accessClassOf(catalog?.FreeOrPremium);
  const accessClass: AccessClass = access === 'coming_soon' || tier.toLowerCase() === 'future' ? 'coming_soon' : access;
  return {
    id,
    name: trimmed(manifest.PackName) || trimmed(catalog?.PackName) || id,
    tier,
    marketableAs,
    pctVerifiedOrNash: pct,
    readinessScore: readiness ? parsePct(readiness) : null,
    sourceSheets: trimmed(manifest.SourceSheets).split(/\s*;\s*/).filter(Boolean),
    rowCount: rowCountRaw ? parsePct(rowCountRaw) : null,
    freeOrPremium: trimmed(catalog?.FreeOrPremium),
    difficulty: trimmed(catalog?.Difficulty),
    estimatedHours: trimmed(catalog?.EstimatedHours),
    status: trimmed(catalog?.Status),
    accessClass,
    verifiedBadge: verified,
    tierBadge: tierBadgeOf(marketableAs, verified),
  };
}

/** Build the catalog from the two tables. Manifest is the spine; joined to catalog by PackID. Sorted by id. */
export function buildPackCatalog(manifests: Row[], catalogRows: Row[]): Pack[] {
  const byId = new Map<string, Row>();
  for (const c of catalogRows) {
    const id = trimmed(c.PackID);
    if (id && !byId.has(id)) byId.set(id, c);
  }
  const packs: Pack[] = [];
  for (const m of manifests) {
    const p = normalizePack(m, byId.get(trimmed(m.PackID)));
    if (p) packs.push(p);
  }
  packs.sort((a, b) => a.id.localeCompare(b.id));
  return packs;
}

/** Find one pack by id (for the detail screen). */
export function packById(packs: Pack[], id: string): Pack | null {
  return packs.find(p => p.id === id) ?? null;
}

/** Availability for a given entitlement. FAIL-CLOSED: premium content is locked unless explicitly entitled. */
export function availabilityOf(pack: Pack, hasPremium: boolean): PackAvailability {
  switch (pack.accessClass) {
    case 'coming_soon': return 'coming_soon';
    case 'free':
    case 'free_plus_premium': return 'available';
    case 'premium': return hasPremium ? 'available' : 'locked';
    default: return 'locked';
  }
}

/** Convenience for the UI: is this pack openable right now for this entitlement? */
export function isOpenable(pack: Pack, hasPremium: boolean): boolean {
  return availabilityOf(pack, hasPremium) === 'available';
}
