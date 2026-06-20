# T Poker — Immersive Poker-Table Design System (STEP 5.3)

**Branch:** `feature/v2-poker-platform` · **Flag:** `immersive` (beta + dev on, **prod off**) · No PR/merge.

## Intent
Make T Poker feel like a premium poker platform, not a utility. A reusable, on-brand (Velvet Table: navy +
gold, now with deep-green **felt**) table component system powers sessions, study, training, and coach — and
is the foundation for future GTO/study and hand-replay content. Everything is flag-gated and additive: with
`immersive` off (and in production), screens render exactly as before.

## Visual language
- **Felt surface:** deep green (`felt #15413A` → `feltDeep #0C2A26`) oval with a **gold rim** hairline + inner
  vignette + soft drop shadow. Sits inside the existing dark navy screen — green reads as a real table without
  fighting the brand. Gold remains the accent (rim, pot, dealer button, position pills, active rings).
- **Depth & hierarchy:** layered shadows, elevated cards, a clear center (cards/pot) with seats radiating out.
- **Motion:** intentionally restrained for this pass — static premium composition (no ambient loops) so it's
  performant and reduced-motion-safe by default. The components are structured so deal-in / chips-to-pot
  motion can be layered later behind `useReducedMotion`.

## Pure foundations (tested)
- `utils/seatLayout.ts` — `seatPositions(count, {width,height,inset})`: seats evenly around an ellipse, hero at
  bottom-center. (15 unit tests across this + pokerTable.)
- `utils/pokerTable.ts` — `PokerPosition` + `positionsForSeats(count)` (native table positions, drive GTO/study),
  `PlayerAction` + `ACTION_META` (premium badge metadata), `chipBreakdown(cents)` (chip-stack visuals).

## Components — `components/table/`
| Component | Role |
|---|---|
| `PokerTable` | Felt oval surface (gradient + gold rim + vignette); `children` center slot, `seats` overlay. |
| `TableSeat` | Seated `Avatar` + **native position pill** + name + sub + dealer marker + active ring + optional `ActionBadge`. a11y label includes position + action. |
| `Pot` | Center pot — currency-aware amount (`useMoney`) + `ChipStack`. Motion-ready. |
| `ActionBadge` | Premium Raise/Call/Check/Fold/All-In chip (icon + tint + glow) — not a plain label. |
| `ChipStack` | Stacked-chips visual from `chipBreakdown`; shared by Pot + seats. |
| `DealerButton` | Gold "D" disc. |
| `PlayingCard` / `HoleCards` | Polished shared card(s) (promoted from the Spot Trainer). |
| `TableScene` | High-level: `PokerTable` + seats (via `seatPositions`) + dealer + center pot/slot. The one building block screens use. |
| `TableBackdrop` | Lightweight felt screen-background tint for entry screens. |

## Where it's applied (all behind `immersive`)
1. **Spot Trainer + Decision Trainer** — the spot renders on a `PokerTable` with `HoleCards` in the center and
   the hero seat showing its **native position pill** + dealer cue; on reveal, the chosen action shows as an
   `ActionBadge`. Strongest "position-aware, at-the-table" study moment. Logic unchanged.
2. **Game summary** (`LocalSessionSummaryScreen`) — a `TableScene` seating every player with their net result +
   a center `Pot` (total pot), above the existing settlements.
3. **Study entry** (`StudyScreen`) — `TableBackdrop` behind the streak hero.
4. **Coach demo result** (`CoachResultScreen`) — `TableBackdrop` (keeps the "Demo Analysis — Not Live AI Yet" label).

## Accessibility & performance
- Reduced-motion safe (no ambient loops this pass; future motion guards via `useReducedMotion`).
- Seats/pot/dealer/cards carry a11y labels (position + action announced); chip stacks are decorative (hidden).
- Transforms/opacity only; modest element counts; graceful on small screens/web (LinearGradient + Views, no new deps).
- Contrast: gold/cream text on felt verified legible; the felt keeps brand contrast.

## Reuse & roadmap (foundations only — NOT a hand replayer)
`TableScene` + seats/pot/badges/cards are the substrate for: new-session seating preview, live-session table view,
coach example hands, GTO range scenarios, and a future hand replayer. Deferred polish: deal-in/chips-to-pot
motion, new-session-review table preview, table-to-screen transitions.
