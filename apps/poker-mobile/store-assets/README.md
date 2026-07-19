# Store Assets

Generated from the real app (Playwright captures of the production web bundle)
and the source icon. Submission-valid; a designer pass can replace any of these.

> ⚠️ **Harness missing / regeneration TODO (2026-07-19):** the `store-shots.js` capture
> script referenced here and in CLAUDE.md is **not committed to the repo** — it must be
> re-authored (or run from a local copy) before the next regeneration. The current PNGs
> are all game-management shots and **predate the free-first study pillar**; the intended
> **study-first** set below still needs the three study screens captured (Spot Trainer,
> Lessons, daily quiz) at each store size.

| File | Store slot |
|------|-----------|
| `icon-1024.png` | App Store icon (1024×1024) |
| `icon-512.png` | Play Store icon (512×512) |
| `feature-graphic-1024x500.png` | Play Store feature graphic (required) |
| `screenshots/play-phone/*` | Play phone screenshots — 1080×1920 |
| `screenshots/ios-6.7/*` | App Store 6.7" — 1290×2796 (required slot) |
| `screenshots/ios-5.5/*` | App Store 5.5" — 1242×2208 |

Screenshot set — **study-first upload order** (free-first launch; leads with the
education pillar for App Store classification). ⭐ = still needs to be captured:

1. ⭐ `01-spot-trainer` — Spot Trainer drill (decision + feedback)
2. ⭐ `02-lessons` — Lessons library (3 free + "Coming soon" locked)
3. ⭐ `03-daily-quiz` — daily quiz question + result
4. `04-home` — guest home, Cash/Tournament entry cards _(currently `01-home`)_
5. `05-tournament-live` — blind clock + prize pool _(currently `02-tournament-live`)_
6. `06-final-count` — The Final Count balance check _(currently `04-final-count`)_
7. `07-cash-summary` — results + cash settlements _(currently `05-cash-summary`)_
8. `08-stats` — table stats _(currently `06-stats`)_

The existing game-management PNGs (`0x-*.png`) remain valid captures; they only
need renumbering once the three study shots are added.
