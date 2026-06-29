# T Poker V2 — Analytics Instrumentation Report (STEP 5.1)

**Branch:** `feature/v2-poker-platform` · **Commit:** `3aba3ab` · **Date:** 2026-06-20 · No PR/merge, no vendor wired.

## Scope
Tier-1 (revenue + core loop) events from `docs/v2-analytics-event-model.md`, plus the Coach beta "demo" label. Additive over the existing `track()` seam; `dispatch()` remains a no-op (events buffer in-memory / dev console only — nothing leaves the device).

## Events implemented & verified
| Event | Props | Fires at |
|---|---|---|
| `paywall_viewed` | `{ trigger }` | PaywallScreen mount (`trigger` from route param) |
| `paywall_plan_selected` | `{ plan }` | plan toggle |
| `purchase_started` | `{ plan }` | upgrade tap |
| `purchase_completed` | `{ plan }` | purchase success |
| `purchase_failed` | `{ plan, reason }` | purchase failure |
| `restore_started` | — | restore tap |
| `restore_result` | `{ ok }` | restore resolved |
| `coach_analysis_requested` | `{ kind }` | analyze start (CoachContext) |
| `coach_analysis_completed` | `{ kind, provider }` | analysis success |
| `coach_analysis_failed` | `{ reason }` | denial/error (no_credits/rate_limited/requires_account/unavailable) |
| `local_game_started` | `{ mode }` | local game created |
| `local_game_finished` | `{ mode, players_band }` | local game ended (player count bucketed) |

**Paywall `trigger` sources:** `coach_upgrade` (Coach Go-Premium), `coach_no_credits` (out-of-credits redirect), `profile` (Profile row), `unknown` (fallback).

## Verification
- `npx tsc --noEmit` clean; `npx jest` 190/190.
- **Independent code review — PASS** on all checks: coverage (all 11 emitted), name/prop correctness, **PII-free** (all categorical/bucketed — no emails/names/raw amounts/tokens/device ids), purely additive (no flow logic changed), no double-fire (coach server/legacy paths mutually exclusive; `paywall_viewed` once per mount), demo label present on CoachScreen + CoachResultScreen.
- Minor doc note: the model's `restore_started/restore_result {ok}` formatting was ambiguous; implemented as `restore_started` (no props) + `restore_result {ok}` — reasonable (result unknown at start).

## Tier-2 events implemented & verified (STEP 5.2)
| Event | Props | Fires at |
|---|---|---|
| `study_trainer_started` | `{ mode }` | SpotTrainerScreen mount (once) |
| `study_spot_answered` | `{ mode, correct }` | each answered spot |
| `study_trainer_finished` | `{ mode, score_band }` | quiz complete / Decision-Trainer Finish (bucketed band) |
| `bankroll_session_logged` | `{ gameType, source }` | new session save only (not edit) |
| `group_created` | — | CreateGroup success |
| `group_joined` | — | JoinGroup (invite link) success |
| `achievement_unlocked` | `{ key, rarity, source }` | local (EngagementContext) + server (StatsScreen fresh unlocks) |
| `rank_up` | `{ rank }` | rank index increases |

Verified: tsc clean; jest 190/190; **code-review PASS** (coverage/correctness/PII/additive/no-double-fire/dual-source consistency). All guarded against double-fire (mount-once, `seenAchievements` cache, rank-index comparison, new-add-only).

## Missing events (register — Tier 3, post-beta)
`reminder_enabled {kind}`, `reminder_tapped {kind}`, `streak_milestone {days}`, `currency_changed {code}`.

## Not done by design
- **No analytics vendor wired** — `dispatch()` is still a no-op (per instruction). Wiring (provider key + `identify`/`reset`) is an RC task; the seam is ready and needs no call-site changes.
- **Coach is mock** — the "Demo Analysis — Not Live AI Yet" label is shown until a real AI vendor ships.

## Recommendation
Instrument Tier-2 next (same additive pattern) so the beta funnel covers the full loop; defer Tier-3 + vendor wiring. **Paused here before the beta build profile**, per instruction.
