# Store Assets

Generated from the real app (Playwright captures of the web bundle) and the source
icon. Submission-valid; a designer pass can replace any of these.

## Submission principle — EDUCATION FIRST (read before changing anything here)

T Poker submits under an **individual** Apple Developer account, so the
education/utility classification must be unmistakable and nothing may read as a poker
*game*. Practical rules for these assets:

- The screenshot set **leads with learning** (placement test → lessons → quiz → trainer
  → study hub). Never reorder so a game-night shot comes first.
- Game-night shots are framed as a **buy-in ledger + settlement calculator**, not
  gameplay. The settlement screen carries an on-screen line that the app never moves
  money.
- Keep money figures modest and unremarkable (a $400 headline reads like a prize pool;
  a $20 buy-in reads like four friends splitting a night). The seeded demo game in
  `store-shots.mjs` is built that way on purpose.
- Never use casino vocabulary in captions, alt text, or filenames.

Full submission guidance: `docs/store-release.md` · `docs/release/store-submission-readiness.md`.

## Regenerating screenshots

The harness is [`store-shots.mjs`](store-shots.mjs) (Playwright; deliberately **not** a
repo dependency — install it locally). It captures **7 of the 10 shots** fully
automatically by seeding guest state (`hasSeenOnboarding`, a fixed persona, and one
finished demo game) via `addInitScript`, so regeneration is deterministic and no longer
depends on hand-built device state.

```bash
# 1) build + serve the web bundle (from the repo)
cd apps/poker-mobile && npx expo export -p web
npx serve dist -l 8799 --single

# 2) from a scratch dir (keeps the app's package.json clean):
npm install playwright && npx playwright install chromium
# NOTE: run a COPY of the harness from that dir — node resolves `playwright`
# relative to the script's location, not the cwd.
cp <repo>/apps/poker-mobile/store-assets/store-shots.mjs .
node store-shots.mjs --base http://localhost:8799 \
  --out <repo>/apps/poker-mobile/store-assets/screenshots
```

It renders each profile at a phone CSS viewport × deviceScaleFactor to hit the exact
store pixel size (1080×1920 / 1290×2796 / 1242×2208). `--only <id>` captures a single
screen (`placement | lessons | daily-quiz | spot-trainer | study-home | home |
cash-summary`).

| File | Store slot |
|------|-----------|
| `icon-1024.png` | App Store icon (1024×1024) |
| `icon-512.png` | Play Store icon (512×512) |
| `feature-graphic-1024x500.png` | Play Store feature graphic (required) |
| `screenshots/play-phone/*` | Play phone screenshots — 1080×1920 |
| `screenshots/ios-6.7/*` | App Store 6.7" — 1290×2796 (required slot) |
| `screenshots/ios-5.5/*` | App Store 5.5" — 1242×2208 |

## Screenshot set — education-first order

All ten are captured at every store size. **Play uses 01–08** (8-slot cap — the
tournament shot is intentionally the one dropped); **App Store uses all ten**.

| # | File | What it shows | Auto? | Suggested caption |
|---|------|---------------|-------|-------------------|
| 01 | `01-placement` | "Find your level" placement test intro | yes | Find your level — a five-question placement test |
| 02 | `02-lessons` | Lessons library (3 free open, rest "Soon") | yes | Study modules: ranges, blind defense, tournaments |
| 03 | `03-daily-quiz` | Daily quiz question with A/B/C/D | yes | A new strategy quiz every day, with explanations |
| 04 | `04-spot-trainer` | Spot Trainer decision drill | yes | Decision drills — pick the line, learn why. Practice only; nothing is wagered |
| 05 | `05-study-home` | Study hub — streak, daily goal, training list | yes | Your study streak and daily goal |
| 06 | `06-home` | Guest home — set up a game, recent games | yes | No account needed — start keeping score |
| 07 | `07-final-count` | The Final Count balance check | manual | Count the chips, balance the night |
| 08 | `08-cash-summary` | Results + settlement list | yes | Who owes whom — settled in cash, between friends |
| 09 | `09-stats` | Table stats over time | manual | Your results over time |
| 10 | `10-tournament-live` | Blind timer + pool total | manual | Blind timer for your home game — the app keeps time, not money |

Manual shots (07, 09, 10) are prior captures from seeded device state and are still
accurate — no copy on them has changed. To automate them, extend the `SEED_GAME`
fixture in `store-shots.mjs` with an active cash game (07), more finished games (09),
and an active tournament (10).

The iPad captures in `ipad-screenshots/` are **pre-education-first** game-management
shots. Either capture a study-led iPad set before submitting with tablet support, or
ship iPhone-only (see the readiness checklist).
