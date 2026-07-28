/**
 * Q1.3 — indexing policy pins. app.tpoker.app is the APPLICATION host and must never become a
 * search entry point again: the SPA rewrite answers every path with the same contentless shell,
 * so an indexable app host means an unbounded set of duplicate URLs (one per shared invite link)
 * competing with tpoker.app for brand queries.
 *
 * These are config-shape pins, deliberately readable by someone who has never touched SEO.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const APP = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(APP, p), 'utf8');

describe('app host indexing policy', () => {
  it('sends X-Robots-Tag: noindex for EVERY path — and nothing re-indexes a subtree', () => {
    const vercel = JSON.parse(read('vercel.json'));
    const rules = vercel.headers ?? [];
    const catchAll = rules.find((h: { source: string }) => h.source === '/(.*)');
    expect(catchAll).toBeDefined();
    expect(
      catchAll.headers.find((h: { key: string }) => h.key.toLowerCase() === 'x-robots-tag')?.value,
    ).toMatch(/noindex/);
    // A later, narrower rule wins on Vercel — so a second X-Robots-Tag anywhere could quietly
    // re-index a subtree while the catch-all above still looks correct (fleet find C6).
    const robotsRules = rules.flatMap((r: { headers: { key: string; value: string }[] }) =>
      r.headers.filter(h => h.key.toLowerCase() === 'x-robots-tag'),
    );
    expect(robotsRules).toHaveLength(1);
    // NB: "noindex" CONTAINS "index" — match only standalone positive directives, or this
    // assertion would reject the correct value.
    expect(robotsRules[0].value).not.toMatch(/(^|[\s,])(index|all)([\s,]|$)/);
  });

  it('Vercel runs the injector build itself — the command lives in the repo, not a dashboard field', () => {
    // The first version pinned package.json's build:web, which is NOT what Vercel executes, so it
    // stayed green in exactly the state where the feature did not ship (fleet find C0/C1).
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.buildCommand).toContain('build:web');
    // Root-dir-relative: the project's Root Directory IS apps/poker-mobile, so a `cd` prefix
    // would fail the build outright.
    expect(vercel.buildCommand).not.toContain('cd ');
  });

  it('machine-readable files are excluded from the SPA rewrite so they 404 honestly', () => {
    // Serving HTML with a 200 where a crawler expects XML/JSON is worse than a 404
    // (fleet finds C2/C3): /sitemap.xml is gone, and /.well-known/* must not be answered
    // by the shell either.
    const rewrite = JSON.parse(read('vercel.json')).rewrites[0].source;
    expect(rewrite).toContain('sitemap');
    expect(rewrite).toContain('well-known');
  });

  it('still rewrites app routes to the shell — deep links keep working', () => {
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.rewrites).toHaveLength(1);
    expect(vercel.rewrites[0].destination).toBe('/index.html');
    const re = new RegExp(`^${vercel.rewrites[0].source}$`);
    expect(re.test('/join/group/abc123')).toBe(true); // invite deep link
    expect(re.test('/')).toBe(true);
    expect(re.test('/sitemap.xml')).toBe(false);
    expect(re.test('/.well-known/assetlinks.json')).toBe(false);
  });

  it('robots.txt allows crawling and does NOT Disallow — a blocked crawler never sees the noindex', () => {
    const robots = read('public/robots.txt');
    expect(robots).toMatch(/^\s*Allow:\s*\/\s*$/m);
    expect(robots).not.toMatch(/^\s*Disallow:/m);
  });

  it('robots.txt no longer advertises a sitemap for this host', () => {
    expect(read('public/robots.txt')).not.toMatch(/^\s*Sitemap:/m);
  });

  it('there is NO sitemap on the app host', () => {
    // An empty <urlset> is schema-invalid and Search Console reports it as an error, so the file
    // is deleted outright and excluded from the rewrite above — /sitemap.xml now 404s honestly
    // (fleet find C2).
    expect(() => read('public/sitemap.xml')).toThrow();
  });

  it('every policy page carries a title and a meta description', () => {
    for (const page of ['privacy.html', 'terms.html', 'pricing.html', 'refund.html']) {
      const html = read(`public/${page}`);
      expect(html).toMatch(/<title>[^<]+<\/title>/);
      expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
    }
  });

  it('build:web chains the injector after the export', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['build:web']).toContain('expo export -p web');
    expect(pkg.scripts['build:web']).toContain('injectWebHead');
  });

  it('the shared-link copy stays education-first and keeps the not-gambling line', () => {
    // This text unfurls wherever an invite is shared, so it is a store-classification surface
    // (fleet find C8: the first draft led with the ledger and dropped the disclaimer).
    const src = read('scripts/injectWebHead.mjs');
    const desc = /const DESCRIPTION =\s*'([^']+)'/.exec(src)?.[1] ?? '';
    expect(desc).toMatch(/^Learn poker strategy/);
    expect(desc).toMatch(/not a gambling product/i);
    expect(desc.toLowerCase().indexOf('learn')).toBeLessThan(desc.toLowerCase().indexOf('ledger'));
  });

  it('the injector adds social tags but NO canonical (meaningless on a noindex host)', () => {
    const src = read('scripts/injectWebHead.mjs');
    expect(src).toContain('og:title');
    expect(src).toContain('twitter:card');
    expect(src).toContain('name="description"');
    expect(src).not.toContain('rel="canonical"');
  });
});
