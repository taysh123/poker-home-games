// @ts-check
/**
 * Store screenshot capture harness.
 *
 * Drives the REAL running app with Playwright/Chromium and captures store-sized PNGs of the
 * EDUCATION-FIRST screen set. Renders each store profile at a CSS viewport with a deviceScaleFactor
 * that produces the exact store pixel dimensions (real device layout, crisp px).
 *
 * SUBMISSION PRINCIPLE (individual Apple Developer account — see docs/release/store-submission-readiness.md):
 * T Poker must read unmistakably as EDUCATION + a scorekeeping utility, never as a poker game.
 * The automated shots therefore LEAD WITH LEARNING (placement test → lessons → quiz → trainer →
 * study hub); the game-night captures that follow are framed as a buy-in ledger / settlement
 * calculator. Do not reorder these so a game shot comes first.
 *
 * Playwright is NOT a repo dependency (keeps the app's package.json clean). Run it with a local
 * install, e.g. from a scratch dir:
 *   npm install playwright && npx playwright install chromium
 *   node <path-to-this-file> --base http://localhost:8799 --out <store-assets>/screenshots
 *
 * Args:
 *   --base <url>   App base URL (default: production web).
 *   --out  <dir>   Output root; writes <dir>/<profile>/<NN-name>.png.
 *   --only <name>  Capture a single screen id (see SCREENS below).
 *   --profile <d>  Capture a single profile dir (e.g. ios-6.7).
 *
 * SEEDING IS PER-SCREEN (not per-profile): each screen gets its own fresh browser context with
 * exactly the local games it needs. This matters because an ACTIVE game raises the floating
 * LiveGameBar on every screen — so the tournament-live shot seeds its active tournament in its OWN
 * context and the study/ledger shots never see it. 07-final-count is intentionally NOT automated
 * (it needs a live mid-count cash game); its prior phone captures stay valid.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const argVal = (flag, def) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const BASE = argVal('--base', 'https://app.tpoker.app');
const OUT = argVal('--out', path.join(path.dirname(fileURLToPath(import.meta.url)), 'screenshots'));
const ONLY = argVal('--only', null);
const ONLY_PROFILE = argVal('--profile', null);

// CSS viewport × deviceScaleFactor = exact store pixels.
const PROFILES = [
  { dir: 'play-phone', width: 360,  height: 640,  dsf: 3 }, // 1080×1920 (Play phone)
  { dir: 'ios-6.7',    width: 430,  height: 932,  dsf: 3 }, // 1290×2796 (App Store 6.7", required)
  { dir: 'ios-5.5',    width: 414,  height: 736,  dsf: 3 }, // 1242×2208 (App Store 5.5")
  { dir: 'ipad-13',    width: 1024, height: 1366, dsf: 2 }, // 2048×2732 (App Store iPad 12.9"/13")
];

/**
 * Deterministic guest state, injected BEFORE any app script runs.
 *
 * `hasSeenOnboarding` bypasses the first-run funnel entirely — since Wave 1 the personalized
 * quiz occupies that route, and walking five steps per capture would be slow and brittle. The
 * pinned persona makes every personalized surface render identically on every regeneration
 * (goal 'improve' ⇒ the study-led home hero; `placement: null` keeps the placement test
 * reachable so it can be captured).
 */
const SEED_PERSONA = {
  schemaVersion: 1,
  goal: 'improve',
  skill: 'solid',
  format: 'both',
  placement: null,
  displayName: null,
  completedAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
};

/**
 * Two finished cash games, so the ledger shots (home recents, stats, settlement summary) are
 * reproducible instead of hand-captured. Deliberately modest amounts — a $400 headline reads like
 * a prize pool; $20–25 buy-ins read like friends splitting a night. Buy-ins total the cash-outs.
 */
const T0 = '2026-07-20T20:00:00.000Z';
const T1 = '2026-07-20T23:30:00.000Z';
const P = { alex: 'p-alex', dana: 'p-dana', jordan: 'p-jordan', sam: 'p-sam' };
const SEED_GAME = {
  id: 'seed-friday',
  schemaVersion: 4,
  name: 'Friday Night',
  status: 'Finished',
  mode: 'cash',
  createdAt: T0,
  endedAt: T1,
  updatedAt: T1,
  defaultBuyInCents: 2000,
  players: [
    { id: P.alex, name: 'Alex' },
    { id: P.dana, name: 'Dana' },
    { id: P.jordan, name: 'Jordan' },
    { id: P.sam, name: 'Sam' },
  ],
  txns: [
    { id: 't1', playerId: P.alex, kind: 'buyin', amountCents: 2000, at: T0 },
    { id: 't2', playerId: P.dana, kind: 'buyin', amountCents: 2000, at: T0 },
    { id: 't3', playerId: P.jordan, kind: 'buyin', amountCents: 2000, at: T0 },
    { id: 't4', playerId: P.sam, kind: 'buyin', amountCents: 2000, at: T0 },
    { id: 't5', playerId: P.dana, kind: 'buyin', amountCents: 2000, at: T0 }, // one rebuy
    { id: 't6', playerId: P.alex, kind: 'cashout', amountCents: 3200, at: T1 },
    { id: 't7', playerId: P.dana, kind: 'cashout', amountCents: 1500, at: T1 },
    { id: 't8', playerId: P.jordan, kind: 'cashout', amountCents: 4300, at: T1 },
    { id: 't9', playerId: P.sam, kind: 'cashout', amountCents: 1000, at: T1 },
  ],
};

const S0 = '2026-07-19T20:30:00.000Z';
const S1 = '2026-07-19T23:15:00.000Z';
const Q = { alex: 'q-alex', jordan: 'q-jordan', sam: 'q-sam' };
const SEED_GAME2 = {
  id: 'seed-saturday',
  schemaVersion: 4,
  name: 'Saturday Night',
  status: 'Finished',
  mode: 'cash',
  createdAt: S0,
  endedAt: S1,
  updatedAt: S1,
  defaultBuyInCents: 2500,
  players: [
    { id: Q.alex, name: 'Alex' },
    { id: Q.jordan, name: 'Jordan' },
    { id: Q.sam, name: 'Sam' },
  ],
  txns: [
    { id: 's1', playerId: Q.alex, kind: 'buyin', amountCents: 2500, at: S0 },
    { id: 's2', playerId: Q.jordan, kind: 'buyin', amountCents: 2500, at: S0 },
    { id: 's3', playerId: Q.sam, kind: 'buyin', amountCents: 2500, at: S0 },
    { id: 's4', playerId: Q.alex, kind: 'cashout', amountCents: 4000, at: S1 },
    { id: 's5', playerId: Q.jordan, kind: 'cashout', amountCents: 2000, at: S1 },
    { id: 's6', playerId: Q.sam, kind: 'cashout', amountCents: 1500, at: S1 },
  ],
};

/** Standard 15-min levels, matching blinds.ts generateBlindLevels('standard') (first 6 shown). */
const TOURN_LEVELS = [
  { smallBlind: 25, bigBlind: 50, durationSeconds: 900 },
  { smallBlind: 50, bigBlind: 100, durationSeconds: 900 },
  { smallBlind: 75, bigBlind: 150, durationSeconds: 900 },
  { smallBlind: 100, bigBlind: 200, durationSeconds: 900 },
  { smallBlind: 150, bigBlind: 300, durationSeconds: 900 },
  { smallBlind: 200, bigBlind: 400, durationSeconds: 900 },
];

/**
 * A live tournament for the dashboard shot. ACTIVE, so it is seeded only in the tournament-live
 * context (an active game floats the LiveGameBar everywhere else). Modest $20 entries → $120 total
 * buy-ins. `clock.lastResumeMs` is stamped to the browser's Date.now() at inject time (see
 * seedGuestState) so the running countdown looks live and fresh on every capture.
 */
const TT0 = '2026-07-21T20:00:00.000Z';
const TP = { alex: 'tp-alex', dana: 'tp-dana', jordan: 'tp-jordan', sam: 'tp-sam', riley: 'tp-riley', max: 'tp-max' };
const SEED_TOURNAMENT = {
  id: 'seed-tourney',
  schemaVersion: 4,
  name: 'Tuesday Tournament',
  status: 'Active',
  mode: 'tournament',
  createdAt: TT0,
  updatedAt: TT0,
  players: [
    { id: TP.alex, name: 'Alex' },
    { id: TP.dana, name: 'Dana' },
    { id: TP.jordan, name: 'Jordan' },
    { id: TP.sam, name: 'Sam' },
    { id: TP.riley, name: 'Riley' },
    { id: TP.max, name: 'Max' },
  ],
  txns: [
    { id: 'x1', playerId: TP.alex, kind: 'buyin', amountCents: 2000, at: TT0, tag: 'entry' },
    { id: 'x2', playerId: TP.dana, kind: 'buyin', amountCents: 2000, at: TT0, tag: 'entry' },
    { id: 'x3', playerId: TP.jordan, kind: 'buyin', amountCents: 2000, at: TT0, tag: 'entry' },
    { id: 'x4', playerId: TP.sam, kind: 'buyin', amountCents: 2000, at: TT0, tag: 'entry' },
    { id: 'x5', playerId: TP.riley, kind: 'buyin', amountCents: 2000, at: TT0, tag: 'entry' },
    { id: 'x6', playerId: TP.max, kind: 'buyin', amountCents: 2000, at: TT0, tag: 'entry' },
  ],
  tournament: {
    entryFeeCents: 2000,
    payouts: [50, 30, 20],
    blindLevels: TOURN_LEVELS,
    clock: { status: 'running', levelIndex: 1, lastResumeMs: 0, remainingMsAtResume: 8 * 60 * 1000 },
    startingStackChips: 10000,
    rebuysAllowed: true,
    addOnsAllowed: false,
    lateRegLevels: 2,
    eliminations: [{ playerId: TP.max, position: 6, at: TT0 }], // Max out 6th → 5 left
  },
};

/** Default local games for the ledger/stats shots — two finished cash games, no active game. */
const DEFAULT_GAMES = [SEED_GAME, SEED_GAME2];

async function seedGuestState(context, games) {
  await context.addInitScript(([personaJson, gamesJson]) => {
    try {
      localStorage.setItem('hasSeenOnboarding', 'true');
      localStorage.setItem('tpoker.persona.v1', personaJson);
      const parsed = JSON.parse(gamesJson);
      // Stamp any running tournament clock to load time so the countdown is live + fresh.
      for (const g of parsed.games) {
        if (g.mode === 'tournament' && g.tournament?.clock?.status === 'running') {
          g.tournament.clock.lastResumeMs = Date.now();
        }
      }
      localStorage.setItem('tpoker.localGames.v1', JSON.stringify(parsed));
    } catch { /* storage unavailable — the run just falls back to the live first-run path */ }
  }, [
    JSON.stringify({ schemaVersion: 1, byAccount: { guest: SEED_PERSONA } }),
    JSON.stringify({ schemaVersion: 4, games }),
  ]);
}

/**
 * EDUCATION-FIRST screen set. Each entry says how to reach the screen and how long to let it
 * settle. `card` is matched against the Train/entry card's aria-label prefix. `games` overrides the
 * default finished-cash seed for that screen's own context.
 */
const SCREENS = [
  { id: 'placement',    file: '01-placement',    card: 'Find your level', settleMs: 1600 },
  { id: 'lessons',      file: '02-lessons',      card: 'Lessons',         settleMs: 1600 },
  { id: 'daily-quiz',   file: '03-daily-quiz',   card: 'Quizzes',         settleMs: 1600,
    after: async (page) => { await clickText(page, 'Start quiz', 8000); } },
  // NOTE: SpotTrainerScreen picks its spot with Math.random on mount, so this one frame is NOT
  // byte-reproducible run-to-run (the content is always a valid preflop spot). Everything else is
  // deterministic from the seed.
  { id: 'spot-trainer', file: '04-spot-trainer', card: 'Spot Trainer',    settleMs: 2200 },
  // The Study hub itself — streak, daily goal, and the training library. No card click.
  { id: 'study-home',   file: '05-study-home',   card: null,              settleMs: 1600 },
  // ── Ledger shots (framed as scorekeeping, never gameplay) ──
  { id: 'home',         file: '06-home',         card: null,              settleMs: 1600, tab: 'Home' },
  { id: 'cash-summary', file: '08-cash-summary', card: null,              settleMs: 1800, tab: 'Home',
    after: async (page) => { await clickText(page, 'Friday Night', 9000); } },
  { id: 'stats',        file: '09-stats',        card: null,              settleMs: 1600, tab: 'Track',
    // exact:true + last() targets the visible "Stats" segment (RN-web keeps other screens mounted,
    // so a substring/first match can resolve to a hidden duplicate and never become clickable).
    after: async (page) => { await page.getByText('Stats', { exact: true }).last().click({ timeout: 8000 }); } },
  // The one active game, in its own context so its LiveGameBar never leaks into the shots above.
  // Reached via the LiveGameBar (present on every screen) by its accessibility role+label — the
  // session-row text has pointerEvents:none, and getByRole skips the hidden mounted duplicates.
  { id: 'tournament-live', file: '10-tournament-live', card: null, settleMs: 2400, tab: 'Home',
    games: [SEED_TOURNAMENT],
    after: async (page) => { await page.getByRole('button', { name: /^Return to / }).first().click({ timeout: 9000 }); } },
];

async function clickIfPresent(page, selector, timeout) {
  try { await page.locator(selector).first().click({ timeout }); return true; }
  catch { return false; }
}
async function clickText(page, text, timeout) {
  await page.getByText(text, { exact: false }).first().click({ timeout });
}

async function reachTab(page, tab) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(3500);                               // boot + brand splash auto-dismiss (~1.2s)
  await clickIfPresent(page, '[aria-label="Skip intro"]', 3000); // brand splash, if still up
  await clickIfPresent(page, 'text=Continue as guest', 9000);    // Welcome chooser
  await page.waitForTimeout(1500);
  // No onboarding step here by design: hasSeenOnboarding is seeded, so "Continue as guest"
  // resets straight to MainTabs (pinned by navigation/entryRouting.guestContinueTarget).
  if (tab !== 'Home') {
    await page.getByText(tab, { exact: true }).first().click({ timeout: 9000 });
  }
  await page.waitForTimeout(1000);
}

async function captureScreen(page, screen, outPath) {
  await reachTab(page, screen.tab ?? 'Study');
  if (screen.card) {
    await page.locator(`[aria-label^="${screen.card}"]`).first().click({ timeout: 9000 });
  }
  if (screen.after) await screen.after(page);
  await page.waitForTimeout(screen.settleMs);                    // animations + content render
  await page.screenshot({ path: outPath });
}

async function main() {
  const screens = ONLY ? SCREENS.filter(s => s.id === ONLY) : SCREENS;
  if (screens.length === 0) {
    console.error(`Unknown --only id. Valid ids: ${SCREENS.map(s => s.id).join(' | ')}`);
    process.exit(1);
  }
  const profiles = ONLY_PROFILE ? PROFILES.filter(p => p.dir === ONLY_PROFILE) : PROFILES;
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const profile of profiles) {
      const outDir = path.join(OUT, profile.dir);
      fs.mkdirSync(outDir, { recursive: true });
      for (const screen of screens) {
        // Fresh context PER SCREEN so its seed (and any active-game LiveGameBar) is isolated.
        const context = await browser.newContext({
          viewport: { width: profile.width, height: profile.height },
          deviceScaleFactor: profile.dsf,
          colorScheme: 'dark',
          reducedMotion: 'reduce', // freeze entrance animations for clean, deterministic frames
        });
        await seedGuestState(context, screen.games ?? DEFAULT_GAMES);
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
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  console.log('\n=== SUMMARY ===');
  for (const r of results) console.log(r);
  if (results.some(r => r.startsWith('FAIL'))) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
