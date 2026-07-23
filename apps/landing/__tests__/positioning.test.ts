import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as CONTENT from '../lib/content';
import { SITE } from '../lib/site';

/**
 * POSITIONING PINS.
 *
 * We submit to the App Store under an INDIVIDUAL Apple Developer account. Apple requires an
 * organization account for apps classified as gambling or simulated gambling, so the marketing site
 * — the first thing a reviewer opens — must be unmistakably an education + scorekeeping product and
 * must never read as a poker game or a place where money moves.
 *
 * These tests pin that posture so a future copy or design change cannot quietly undo it. See
 * docs/release/store-submission-readiness.md § "The standing principle".
 *
 * WHAT THIS FILE CANNOT SEE — read before trusting a green run:
 * These are source-text assertions. They cannot inspect the CONTENT of a PNG, so a screenshot or
 * an OG card that depicts a felt table, a pot, or a price passes every test here. Image content
 * needs a human look. That is not hypothetical: the first draft of this slice deleted the felt
 * mock from the hero and then shipped a photograph of one in the screenshot strip, with the whole
 * suite green. Whoever changes `public/screenshots/` or `public/og.png` must open the files.
 */

const ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

/** Every string reachable from lib/content.ts, flattened. */
function allCopyStrings(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(CONTENT);
  return out;
}

describe('positioning — education leads', () => {
  it('the hero promises learning, not a poker table', () => {
    const hero = `${CONTENT.HERO.eyebrow} ${CONTENT.HERO.title} ${CONTENT.HERO.subhead}`.toLowerCase();
    expect(hero).toMatch(/learn|stud(y|ies)|lesson|training|quiz|drill/);
  });

  it('states plainly, in body copy, that it is not gambling and is 18+', () => {
    const body = CONTENT.WHAT_IT_IS.body.toLowerCase();
    expect(body).toContain('not a gambling product');
    expect(body).toContain('18+');
    // Must not require an interaction to read: the statement is its own section, not an FAQ panel.
    // Matched with a leading newline + indentation so a commented-out `{/* <WhatItIs /> */}`
    // cannot satisfy it.
    expect(read('app/page.tsx')).toMatch(/^\s*<WhatItIs \/>$/m);
  });

  it('answers the gambling question first in the FAQ', () => {
    expect(CONTENT.FAQ_ITEMS[0].q.toLowerCase()).toContain('gambling');
    // ...and that first item is open by default. Whitespace-tolerant: the behaviour is "seeded to
    // 0", and reformatting the type annotation should not fail the test.
    expect(read('components/blocks/Faq.tsx')).toMatch(/useState<number\s*\|\s*null>\(0\)/);
  });
});

describe('positioning — nothing purchasable is priced', () => {
  // The original version of this pinned the two literal key names `monthly`/`yearly`, which any
  // rename (`price`, `monthlyUsd`, a nested `plans` object) would have walked straight past. Reject
  // any numeric field that looks like money instead.
  it('PRICING carries no price figure under any key name', () => {
    const numbers: Array<[string, number]> = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'number') numbers.push([path, v]);
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
      }
    };
    walk(CONTENT.PRICING, 'PRICING');
    expect(numbers, `PRICING must hold no numeric price: ${JSON.stringify(numbers)}`).toEqual([]);
  });

  it('no copy string quotes a subscription price', () => {
    for (const s of allCopyStrings()) {
      expect(s, `priced copy: ${s}`).not.toMatch(
        /\$\s?\d+(\.\d{2})?\s*(\/|per\b|a\b|billed\b)?\s*(mo\b|month|yr\b|year|annual)/i,
      );
    }
  });

  it('the pricing section renders no currency and no billing toggle', () => {
    const src = read('components/blocks/Pricing.tsx');
    expect(src).not.toMatch(/PRICING\.(monthly|yearly)/);
    expect(src).not.toMatch(/aria-label="Billing period"/);
    expect(src).toContain('PRICING.premium.priceNote');
    // No literal price in the JSX either — `$0` on the Free card is the one allowed exception,
    // because zero is not a price and the free tier genuinely costs nothing.
    const withoutFreeZero = src.replace(/\$0\b/g, '');
    expect(withoutFreeZero).not.toMatch(/\$\d/);
  });
});

describe('positioning — the page shows no table, no pot, no chips', () => {
  it('the hero renders no casino chip, and its styling left with it', () => {
    expect(read('components/blocks/Hero.tsx')).not.toMatch(/HeroChip|PokerChip3D|chip-slot/);
    // The chip's CSS outlived the component once already — dead rules invite reuse.
    expect(read('app/globals.css')).not.toMatch(/\.chip-face|animate-floaty/);
  });

  it('the hero renders no felt and no pot', () => {
    const src = read('components/blocks/Hero.tsx');
    // The felt gradient that used to sit in the hero.
    expect(src).not.toMatch(/#1A4B43|#15413A|#0C2A26/);
    // Matches the rendered word, not a source-adjacent one. The previous version of this test
    // looked for /\bPot\b\s*[₪$]/, which could never match the markup it claimed to ban: the old
    // hero put "Pot" and "₪200" in sibling <span>s, and \s* cannot cross a tag. It passed before
    // the change AND after, guarding nothing.
    expect(src).not.toMatch(/>\s*Pot\s*</);
  });

  it('the screenshot strip leads with study screens and every file exists', () => {
    const src = read('components/blocks/Showcase.tsx');
    const srcs = [...src.matchAll(/src: '\/screenshots\/([^']+)'/g)].map((m) => m[1]);

    expect(srcs.length).toBeGreaterThanOrEqual(3);
    expect(srcs[0]).toMatch(/lesson|quiz|trainer|placement|study/i);

    // A renamed PNG ships as a broken <img> with nothing else to catch it.
    for (const file of srcs) {
      expect(existsSync(join(ROOT, 'public', 'screenshots', file)), `missing: ${file}`).toBe(true);
    }
  });
});

describe('positioning — the free plan matches the app', () => {
  // The landing free-plan list and the in-app pricing page are two hand-maintained copies of the
  // same promise. A comment claiming they match is not enough: the last one said "verbatim" while
  // the strings had already drifted.
  const PRICING_HTML = join(
    ROOT, '..', 'poker-mobile', 'public', 'pricing.html',
  );

  it('every landing free-plan bullet appears in the app pricing page', () => {
    const html = readFileSync(PRICING_HTML, 'utf8');
    const decoded = html.replace(/&amp;/g, '&');
    for (const item of CONTENT.PRICING.free.items) {
      expect(decoded, `not in pricing.html: "${item}"`).toContain(item);
    }
  });
});

describe('publisher identity — footer copyright is the legal name', () => {
  // The app ships under the owner's individual developer account, so the copyright rights-holder is
  // the legal name (Tay Shofer), not the "True Story Labs" studio brand. The Footer renders
  // `© {year} {SITE.company}`, so pinning the constant pins the rendered copyright.
  it('SITE.company is the legal name, not the trade name', () => {
    expect(SITE.company).toBe('Tay Shofer');
    expect(SITE.company).not.toMatch(/True Story Labs/);
  });
});

describe('positioning — no operator idiom', () => {
  // Phrases that belong to gambling operators, not to a study app. "Play responsibly" in
  // particular implies there is something to play here for money. There isn't.
  const BANNED = [/play responsibly/i, /gamble responsibly/i, /real[- ]money gaming/i];

  // Every surface that holds user-visible marketing copy. WhatItIs and Showcase hardcode theirs
  // (pillar text, headings, captions, alt strings) rather than sourcing it from lib/content.ts, so
  // omitting them left the newest copy on the page unguarded.
  const SURFACES = [
    'lib/content.ts',
    'components/blocks/Footer.tsx',
    'components/blocks/TrustBanner.tsx',
    'components/blocks/Hero.tsx',
    'components/blocks/WhatItIs.tsx',
    'components/blocks/Showcase.tsx',
    'components/blocks/SocialProof.tsx',
    'app/layout.tsx',
  ];

  it('no marketing surface borrows operator language', () => {
    for (const rel of SURFACES) {
      const src = read(rel);
      for (const pattern of BANNED) {
        expect(src, `${rel} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
