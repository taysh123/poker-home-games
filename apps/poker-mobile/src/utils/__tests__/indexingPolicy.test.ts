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
  it('sends X-Robots-Tag: noindex for EVERY path', () => {
    const vercel = JSON.parse(read('vercel.json'));
    const rule = (vercel.headers ?? []).find((h: { source: string }) => h.source === '/(.*)');
    expect(rule).toBeDefined();
    const header = rule.headers.find((h: { key: string }) => h.key.toLowerCase() === 'x-robots-tag');
    expect(header?.value).toMatch(/noindex/);
  });

  it('still REWRITES every path to the shell (the header, not the rewrite, is what changed)', () => {
    const vercel = JSON.parse(read('vercel.json'));
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });

  it('robots.txt allows crawling and does NOT Disallow — a blocked crawler never sees the noindex', () => {
    const robots = read('public/robots.txt');
    expect(robots).toMatch(/^\s*Allow:\s*\/\s*$/m);
    expect(robots).not.toMatch(/^\s*Disallow:/m);
  });

  it('robots.txt no longer advertises a sitemap for this host', () => {
    expect(read('public/robots.txt')).not.toMatch(/^\s*Sitemap:/m);
  });

  it('the sitemap lists NOTHING — the app host submits no URLs for indexing', () => {
    const sitemap = read('public/sitemap.xml');
    expect(sitemap).toContain('<urlset');
    expect(sitemap).not.toMatch(/<loc>/);
  });

  it('every policy page carries a title and a meta description', () => {
    for (const page of ['privacy.html', 'terms.html', 'pricing.html', 'refund.html']) {
      const html = read(`public/${page}`);
      expect(html).toMatch(/<title>[^<]+<\/title>/);
      expect(html).toMatch(/<meta name="description" content="[^"]{40,}"/);
    }
  });

  it('the web build runs the head injector, so shared invite links unfurl with real metadata', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['build:web']).toContain('expo export -p web');
    expect(pkg.scripts['build:web']).toContain('injectWebHead');
  });

  it('the injector adds social tags but NO canonical (meaningless on a noindex host)', () => {
    const src = read('scripts/injectWebHead.mjs');
    expect(src).toContain('og:title');
    expect(src).toContain('twitter:card');
    expect(src).toContain('name="description"');
    expect(src).not.toContain('rel="canonical"');
  });
});
