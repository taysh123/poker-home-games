/**
 * Regenerates `public/og.png` — the 1200×630 card shown whenever the site URL is pasted into
 * Slack, iMessage, X, or a store-review ticket. It is often the FIRST thing anyone sees of
 * T Poker, so it follows the same rule as everything else store-facing: education leads, and
 * nothing may read as a poker game. See docs/release/store-submission-readiness.md.
 *
 * Playwright is deliberately NOT a repo dependency (same call as store-shots.mjs). To run:
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/og.mjs
 *
 * Fonts load from Google's CDN at generation time — this is a build tool, not shipped code.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og.png');

// Punctuation is written as HTML entities on purpose: this file gets copied between shells during
// generation, and a UTF-8 round-trip through PowerShell turns a literal "·" into mojibake.
const EYEBROW = 'POKER STRATEGY TRAINING &middot; HOME-GAME SCOREKEEPING';
const HEADLINE = 'Learn poker properly.';
const SUBLINE =
  'Lessons, daily quizzes &amp; decision drills &mdash; plus a clean ledger for game night.';
const FOOTNOTE = 'Not a gambling product &middot; 18+';
const DOMAIN = 'tpoker.app';

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: #0F1923;
    background-image: radial-gradient(ellipse 90% 70% at 78% 8%, rgba(201,168,76,0.10), transparent 60%);
    font-family: Inter, system-ui, sans-serif;
    color: #FFFFFF;
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 88px;
  }
  .eyebrow {
    font-size: 20px; font-weight: 600; letter-spacing: 0.16em;
    color: #C9A84C; margin-bottom: 26px;
  }
  h1 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 92px; line-height: 1.02; font-weight: 400; letter-spacing: -0.01em;
  }
  .sub { margin-top: 26px; font-size: 27px; line-height: 1.45; color: #E8EDF2; max-width: 900px; }
  .foot {
    position: absolute; left: 88px; right: 88px; bottom: 52px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { width: 46px; height: 46px; border-radius: 11px; }
  .brand span { font-family: 'DM Serif Display', Georgia, serif; font-size: 27px; }
  .meta { font-size: 19px; color: #7A8A99; text-align: right; line-height: 1.5; }
  .meta strong { color: #E8EDF2; font-weight: 500; }
</style></head>
<body>
  <div class="eyebrow">${EYEBROW}</div>
  <h1>${HEADLINE}</h1>
  <p class="sub">${SUBLINE}</p>
  <div class="foot">
    <div class="brand">
      <img src="brand/app-icon-128.png" alt="">
      <span>T Poker</span>
    </div>
    <div class="meta"><strong>${FOOTNOTE}</strong><br>${DOMAIN}</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// Served from public/ so the relative <img src="brand/..."> resolves.
await page.goto(`http://localhost:${process.env.OG_PORT || 4321}/`);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: OUT });
await browser.close();
console.log('wrote', OUT);
