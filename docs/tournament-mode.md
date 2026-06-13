# Tournament Mode — Architecture & Phased Plan

Status: **v2 SHIPPED (local-first, flexible)** — June 2026. Builds on the v1
freezeout with real tournament-director controls. Engine:
`apps/poker-mobile/src/local/tournament.ts` + `blinds.ts` (Jest-pinned, 59 tests).
**Next: server-side group tournaments** per the design below (the local model is
the proven template).

## v2 — what shipped (schema v3, local-first for guests + signed-in)

- **Flexible payouts:** 1–6 paid places with editable percentages (custom
  distributions), seeded from presets; largest-remainder allocation always sums to
  the pool. `payoutAmountsCents(pool, percents[])`.
- **Editable blind structures:** presets are generators; the wizard can add/remove/
  edit levels (SB/BB/ante/minutes/break).
- **Stored blind clock:** pause/resume, manual ±level, auto-advance at expiry,
  survives reload (replaces the derived-from-`createdAt` clock). Pure functions in
  `blinds.ts`; store mutations persist it.
- **Late registration:** open through a configurable level window; late entries pay
  a tagged entry into the pool. Elimination positions count remaining-before-bust so
  the math stays correct after late joins.
- **Rebuys + add-ons:** config-gated, recorded as tagged buy-ins feeding the pool.
- **Starting stack:** powers the dashboard's average stack + approximate BB-left.
- **Live dashboard:** level/blinds, big countdown, clock controls, players-left,
  avg stack/BB, next-out payout.
- **Early finish:** host manually ranks the remaining players → payouts apply by the
  structure (`finishWithRanking`), in addition to play-to-last-player and Abort.
- **Podium summary:** full standings, payouts, ITM badges, shareable card.

Data location: **local-first for everyone** (guests and signed-in users share the
on-device engine). Server-synced tournaments remain the future work below.

## Product shape

A home-game tournament: everyone pays a fixed entry, blinds rise on a timer,
players bust out in order, and the prize pool pays the top finishers
(e.g. 50/30/20). Optional later: rebuy/add-on windows, bounties, league seasons.

## Core decision: extend `Session`, don't build a parallel aggregate

Add a `SessionType` discriminator (`CashGame` default | `Tournament`) to the
existing `Session` entity rather than a new Tournament aggregate.

**Why:** tournaments reuse almost everything sessions already have — groups and
roles, `SessionPlayer` (including guests + `LinkedUserId`), `BuyIn` records,
the settlement engine (payouts are just settlements from the pool), stats
plumbing, invite tokens, the local-first guest engine, and every session screen.
A separate aggregate would duplicate all of that for ~5 genuinely new concepts.

## Schema additions (all additive, nullable — zero impact on cash games)

```csharp
enum SessionType { CashGame = 0, Tournament = 1 }

Session {
  + SessionType Type                  // discriminator
  + int?    EntryFeeCents             // fixed buy-in
  + int?    MaxPlayers
  + string? PayoutStructureJson       // [{position:1, percent:50}, ...]
}

SessionPlayer {
  + int?      FinishingPosition       // 1 = winner; set on elimination
  + DateTime? BustedAt
}

BuyIn {
  + string? TransactionType           // 'BuyIn' | 'Rebuy' | 'AddOn' (null = cash-game buy-in)
}

NEW BlindLevel : BaseEntity {
  SessionId, Level, SmallBlindCents, BigBlindCents, AnteCents?, DurationSeconds
}
```

## New logic

- **`TournamentPayoutCalculator`** (Application service, mirrors the settlement
  pattern): prize pool = Σ entry/rebuy/add-on buy-ins (minus optional rake) →
  apply payout structure to finishing positions → emit `Settlement` rows
  (losers → winners pro-rata, same engine semantics). Port to TS for local
  tournaments, pinned by shared fixtures like the cash engine.
- **Blind timer**: client-side countdown from `BlindLevel` rows + `StartedAt`
  (deterministic — no server push needed; everyone's phone computes the same
  level). Server stores structure only.
- **Eliminations**: `POST /api/sessions/{id}/eliminations { sessionPlayerId }`
  assigns the next finishing position; undo within the session while Active.

## UI

- New Game wizards (both server + local): a "Tournament" toggle on step 1
  revealing entry fee, payout preset picker (winner-takes-all / 60-40 / 50-30-20 /
  custom), and a blind-structure preset (Turbo/Standard/Deep — editable later).
- Live session screen (conditional on `Type`): blind-level banner with countdown
  (reuses `AnimatedNumber`/motion system), "Bust out" action per player
  (ActionSheet), standings become "remaining + busted (position)".
- The Final Count is replaced for tournaments by the elimination flow — the last
  player standing triggers payout calculation + a podium-styled Game Over.
- Stats additions: tournaments played, ITM%, average finish, ROI.

## Reuse map

| Existing | Role in tournaments |
|---|---|
| Groups/roles/invites | unchanged |
| SessionPlayer + guests | roster + eliminations live here |
| BuyIn | entries/rebuys/add-ons via TransactionType |
| Settlement engine (C# + TS) | pays out the prize pool |
| Local-first engine (`src/local/`) | LocalTournament = LocalGame + config (schemaVersion bump) |
| Celebration/motion system | podium reveal |

## Phased build order (when scheduled)

1. **Backend foundations** — migrations (SessionType, finishing fields, BlindLevel), payout calculator + xUnit fixtures, elimination endpoints. Cash games untouched (Type defaults to CashGame).
2. **Local-first tournament** — TS payout port + Jest, local wizard toggle, blind timer widget, elimination UI, podium summary. (Ships value to guests first, mirrors how guest mode landed.)
3. **Server tournaments** — wizard toggle on NewGame, conditional SessionScreen UI, stats additions.
4. **Polish** — presets library, league/season points (separate decision), bounties.

**Effort estimate:** backend foundations ~1 phase; local tournament ~2 phases; server ~2 phases; polish open-ended.

## Open product questions (decide before build)

1. Rebuy/add-on windows in v1, or freezeout-only first? (Recommend freezeout v1.)
2. Guest payouts: guests can win — payout settlements for unlinked guests become cash pairs (same as today's mixed-session handling). Confirm acceptable.
3. Blind presets: ship 3 fixed presets v1, structure editor later?
4. League seasons: separate feature; not in tournament v1.
