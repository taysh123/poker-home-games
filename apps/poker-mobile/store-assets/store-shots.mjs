// @ts-check
/**
 * Store screenshot capture harness.
 *
 * Drives the REAL running app with Playwright/Chromium and captures store-sized PNGs of the
 * study-first screen set. Renders each store profile at a phone CSS viewport with a
 * deviceScaleFactor that produces the exact store pixel dimensions (real phone layout, crisp px).
 *
 * Playwright is NOT a repo dependency (keeps the app's package.json clean). Run it with a local
 * install, e.g. from a scratch dir:
 *   npm install playwright && npx playwright install chromium
 *   node <path-to-this-file> --base https://poker-home-games-three.vercel.app --out <store-assets>/screenshots
 *
 * Args:
 *   --base <url>   App base URL (default: production web).
 *   --out  <dir>   Output root; writes <dir>/<profile>/<NN-name>.png.
 *   --only <name>  Capture a single screen id (spot-trainer | lessons | daily-quiz).
 *
 * The three game-night shots (home, tournament, final-count, cash-summary, stats) are captured
 * from seeded game state and are NOT automated here — they remain valid prior captures.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const argVal = (flag, def) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const BASE = argVal('--base', 'https://poker-home-games-three.vercel.app');
const OUT = argVal('--out', path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots'));
const ONLY = argVal('--only', null);

// CSS viewport × deviceScaleFactor = exact store pixels.
const PROFILES = [
  { dir: 'play-phone', width: 360, height: 640, dsf: 3 }, // 1080×1920 (Play phone)
  { dir: 'ios-6.7',    width: 430, height: 932, dsf: 3 }, // 1290×2796 (App Store 6.7", required)
  { dir: 'ios-5.5',    width: 414, height: 736, dsf: 3 }, // 1242×2208 (App Store 5.5")
];

// Study-first screen set. Each: how to reach it from the Study hub + how long to settle.
const SCREENS = [
  { id: 'spot-trainer', file: '01-spot-trainer', card: 'Spot Trainer', settleMs: 2200 },
  { id: 'lessons',      file: '02-lessons',      card: 'Lessons',      settleMs: 1600 },
  { id: 'daily-quiz',   file: '03-daily-quiz',   card: 'Quizzes',      settleMs: 1600,
    after: async (page) => { await clickText(page, 'Start quiz', 8000); } },
];

async function clickIfPresent(page, selector, timeout) {
  try { await page.locator(selector).first().click({ timeout }); return true; }
  catch { return false; }
}
async function clickText(page, text, timeout) {
  await page.getByText(text, { exact: false }).first().click({ timeout });
}

async function reachGuestHome(page) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(3500);                                   // boot + brand splash auto-dismiss (~1.2s)
  await clickIfPresent(page, 'text=Skip intro', 3000);              // brand splash, if still up
  await clickIfPresent(page, 'text=Continue as guest', 9000);       // Welcome chooser (skipped if already guest)
  await page.waitForTimeout(1500);
  await clickIfPresent(page, '[aria-label="Skip onboarding"]', 6000); // first-run OnboardingV2 pillars
  await page.waitForTimeout(2200);                                  // guest home settles
}

async function captureScreen(page, screen, outPath) {
  await reachGuestHome(page);
  await page.getByText('Study', { exact: true }).first().click({ timeout: 9000 }); // Study tab
  await page.waitForTimeout(800);
  await page.locator(`[aria-label^="${screen.card}"]`).first().click({ timeout: 9000 }); // Train card
  if (screen.after) await screen.after(page);
  await page.waitForTimeout(screen.settleMs);                        // animations + content render
  await page.screenshot({ path: outPath });
}

async function main() {
  const screens = ONLY ? SCREENS.filter(s => s.id === ONLY) : SCREENS;
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const profile of PROFILES) {
      const outDir = path.join(OUT, profile.dir);
      fs.mkdirSync(outDir, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        deviceScaleFactor: profile.dsf,
        colorScheme: 'dark',
        reducedMotion: 'reduce', // freeze entrance animations for clean, deterministic frames
      });
      for (const screen of screens) {
        const outPath = path.join(outDir, `${screen.file}.png`);
        const page = await context.newPage();
        try {
          await captureScreen(page, screen, outPath);
          results.push(`OK   ${profile.dir}/${screen.file}.png`);
          console.log(`captured ${profile.dir}/${screen.file}.png`);
        } catch (err) {
          results.push(`FAIL ${profile.dir}/${screen.file}.png — ${err.message.split('\n')[0]}`);
          console.error(`FAILED ${profile.dir}/${screen.file}.png: ${err.message.split('\n')[0]}`);
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log('\n=== SUMMARY ===');
  for (const r of results) console.log(r);
}

main().catch(e => { console.error(e); process.exit(1); });
