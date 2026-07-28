/**
 * Q1.3 — honesty pins for the homepage's JSON-LD.
 *
 * WHY THIS FILE EXISTS: a critic mutation-tested the first version of the structured data by
 * adding `offers: { price: '4.99' }` and `aggregateRating: { ratingValue: '4.9', reviewCount:
 * '128' }` — and all 15 existing landing tests passed, including the suite named "nothing
 * purchasable is priced". positioning.test.ts walks only strings reachable from lib/content.ts
 * and honesty.test.ts reads lib/features.ts + lib/stores.ts, so layout.tsx's JSON-LD — the most
 * machine-readable claim we publish, which Google can render as a price and a star rating
 * directly in search results — had ZERO honesty coverage. It does now.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const layout = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8');
// Strip comments: this file's own rationale names the banned fields.
const code = layout.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('homepage JSON-LD — machine-readable claims must be as honest as the copy', () => {
  it('publishes structured data at all', () => {
    expect(code).toContain('application/ld+json');
    expect(code).toContain("'@context': 'https://schema.org'");
  });

  it('asserts NO price or offer — nothing in this product is purchasable', () => {
    expect(code).not.toMatch(/['"]offers['"]\s*:/);
    expect(code).not.toMatch(/priceCurrency|['"]price['"]\s*:/);
  });

  it('asserts NO ratings — there are no reviews to cite', () => {
    expect(code).not.toMatch(/aggregateRating|ratingValue|reviewCount|ratingCount/);
  });

  it('omits SoftwareApplication, whose rich result would REQUIRE one of the two fields above', () => {
    // Keeping the node meant Search Console naming `offers`/`aggregateRating` as the fix —
    // steady pressure to fabricate exactly what the honesty rules forbid.
    expect(code).not.toMatch(/SoftwareApplication/);
  });

  it('the entity nodes we do publish carry only verifiable facts', () => {
    expect(code).toMatch(/'@type':\s*'Organization'/);
    expect(code).toMatch(/'@type':\s*'WebSite'/);
    // No claims about corporate structure, staffing, awards or location.
    expect(code).not.toMatch(/founder|employee|numberOfEmployees|award|address/);
  });
});

/**
 * Q1.3 fleet find C7 — the "single entry point" only works if BOTH halves hold. The app host is
 * pinned de-indexed in apps/poker-mobile; nothing pinned that the landing stays INDEXABLE, so a
 * copy-paste of the noindex config would have silently left the product invisible everywhere.
 */
describe('the marketing site must stay the indexable entry point', () => {
  const robots = readFileSync(resolve(__dirname, '../app/robots.ts'), 'utf8');
  const layoutSrc = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8');

  it('robots.ts allows crawling and never disallows', () => {
    expect(robots).toMatch(/allow:\s*'\/'/);
    expect(robots).not.toMatch(/disallow/i);
  });

  it('advertises a sitemap', () => {
    expect(robots).toMatch(/sitemap/i);
  });

  it('metadata never sets noindex on the landing', () => {
    expect(layoutSrc).not.toMatch(/noindex/);
  });

  it('keeps a self-canonical so the app host can never outrank it for brand queries', () => {
    expect(layoutSrc).toMatch(/canonical:\s*'\/'/);
  });
});
