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
repo dependency — install it locally). It captures **9 of the 10 shots** fully
automatically by seeding guest state (`hasSeenOnboarding`, a fixed persona, two finished
demo games, and — for the tournament shot only — one active tournament) via
`addInitScript`. Seeding is **per-screen**: each screen gets its own context, so the
active game's LiveGameBar never leaks into the study/ledger shots. Only 07-final-count
stays manual (it needs a live mid-count cash game).

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

It renders each profile at a CSS viewport × deviceScaleFactor to hit the exact store
pixel size (1080×1920 / 1290×2796 / 1242×2208 / 2048×2732). `--only <id>` captures a
single screen (`placement | lessons | daily-quiz | spot-trainer | study-home | home |
cash-summary | stats | tournament-live`); `--profile <dir>` captures one profile.

| File | Store slot |
|------|-----------|
| `icon-1024.png` | App Store icon (1024×1024) |
| `icon-512.png` | Play Store icon (512×512) |
| `feature-graphic-1024x500.png` | Play Store feature graphic (required) |
| `screenshots/play-phone/*` | Play phone screenshots — 1080×1920 |
| `screenshots/ios-6.7/*` | App Store 6.7" — 1290×2796 (required slot) |
| `screenshots/ios-5.5/*` | App Store 5.5" — 1242×2208 |
| `screenshots/ipad-13/*` | App Store iPad 13" — 2048×2732 (required when tablet support is declared) |

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
| 09 | `09-stats` | Session stats over time (total buy-ins) | yes | Your results over time |
| 10 | `10-tournament-live` | Blind timer + total buy-ins | yes | Blind timer for your home game — the app keeps time, not money |

Only 07-final-count is still manual (a prior capture; its copy is unchanged). To
automate it, extend `store-shots.mjs` with an active cash game paused at the Final Count
step.

The **`ipad-13/`** set (2048×2732) is a study-led capture from the same harness — it uses
the same education-first order as the phone sets. It replaces the old pre-education-first
iPad shots; submit it when declaring tablet support (`supportsTablet: true`).
