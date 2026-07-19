# Store Assets

Generated from the real app (Playwright captures of the web bundle) and the source
icon. Submission-valid; a designer pass can replace any of these.

**Regenerating screenshots** — the harness is [`store-shots.mjs`](store-shots.mjs)
(Playwright; not a repo dependency, install it locally). It captures the three study
screens at all store sizes from a running app:

```bash
# from a scratch dir (keeps the app's package.json clean):
npm install playwright && npx playwright install chromium
# capture from a local production build (recommended) or the live URL:
node <repo>/apps/poker-mobile/store-assets/store-shots.mjs \
  --base http://localhost:8799 \
  --out  <repo>/apps/poker-mobile/store-assets/screenshots
```

It renders each profile at a phone CSS viewport × deviceScaleFactor to hit the exact
store pixel size (1080×1920 / 1290×2796 / 1242×2208). The game-night shots (home,
tournament, final-count, cash-summary, stats) are captured from seeded game state and
are not automated — they remain valid prior captures.

| File | Store slot |
|------|-----------|
| `icon-1024.png` | App Store icon (1024×1024) |
| `icon-512.png` | Play Store icon (512×512) |
| `feature-graphic-1024x500.png` | Play Store feature graphic (required) |
| `screenshots/play-phone/*` | Play phone screenshots — 1080×1920 |
| `screenshots/ios-6.7/*` | App Store 6.7" — 1290×2796 (required slot) |
| `screenshots/ios-5.5/*` | App Store 5.5" — 1242×2208 |

Screenshot set — **study-first order** (free-first launch; leads with the education
pillar for App Store classification). All nine are captured at every store size:

1. `01-spot-trainer` — Spot Trainer drill (live table, hand, Fold/Call/Raise)
2. `02-lessons` — Lessons library (3 free open + the rest "Soon")
3. `03-daily-quiz` — daily quiz question with A/B/C/D
4. `04-home` — guest home, Cash/Tournament entry cards
5. `05-tournament-live` — blind clock + prize pool
6. `06-tournament-podium` — medals, payouts, confetti
7. `07-final-count` — The Final Count balance check
8. `08-cash-summary` — results + cash settlements
9. `09-stats` — table stats

Play Store allows up to 8 phone screenshots (use 01–08); App Store allows up to 10
(use all nine). Screens 01–03 were captured 2026-07-19 from the free-first build;
04–09 are the prior game-management captures, renumbered.
