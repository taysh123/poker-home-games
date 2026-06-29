# T Poker V2 — Analytics & Event Model (STEP 5)

**Branch:** `feature/v2-poker-platform` · **Date:** 2026-06-20 · No PR/merge.

## Context
A client analytics seam exists (`utils/analytics.ts`: `track(event, props)`, in-memory buffer, dev console log, single-use signup-intent helpers) but **`dispatch()` is a no-op** (no vendor) and only **5 events** fire — all onboarding/account funnel. Server-side `IAuditLog` (B5) covers monetization/fraud only. Before beta we need a defined event taxonomy + the high-value product events instrumented, and a vendor wired into `dispatch()`.

## Conventions
- **Names:** `snake_case`, `domain_action` (e.g. `coach_analysis_completed`). Stable, never reused with new meaning.
- **Props:** categorical primitives only. **No PII** (no email/username/free-text), **no raw amounts** — bucket money (`amount_band: '0-50'|'50-200'|…`) and use counts/booleans. `userId` is attached by the provider's identify call, not per-event props.
- **Transport:** all events go through `track()`; wiring a provider is one change in `dispatch()` — no call-site edits.

## Existing events (keep)
| Event | Where | Props |
|---|---|---|
| `onboarding_started` | OnboardingV2 mount | — |
| `onboarding_completed` | starting-point chosen | `{ via }` |
| `onboarding_skipped` | skip/explore | `{ from }` |
| `first_action_completed` | first real flow entered | `{ action }` |
| `account_created` | auth (new/social-intent) | `{ method }` |

## Event model to instrument (by tier)

### Tier 1 — revenue + core loop (pre-beta MUST)
| Event | Fires | Props |
|---|---|---|
| `paywall_viewed` | Paywall mount | `{ trigger }` |
| `paywall_plan_selected` | plan toggle | `{ plan }` |
| `purchase_started` | upgrade tap | `{ plan }` |
| `purchase_completed` / `purchase_failed` | result | `{ plan, reason? }` |
| `restore_started` / `restore_result` | restore | `{ ok }` |
| `coach_analysis_requested` | analyze tap | `{ kind }` |
| `coach_analysis_completed` | success | `{ kind, provider }` |
| `coach_analysis_failed` | denial/error | `{ reason: no_credits\|rate_limited\|requires_account\|unavailable }` |
| `local_game_started` | local game created | `{ mode }` |
| `local_game_finished` | summary reached | `{ mode, players_band }` |

### Tier 2 — engagement loop (pre-beta SHOULD)
`study_trainer_started {mode}`, `study_spot_answered {mode, correct}`, `study_trainer_finished {mode, score_band}`, `bankroll_session_logged {gameType, source}`, `group_created`, `group_joined`, `achievement_unlocked {key, rarity, source}`, `rank_up {rank}`.

### Tier 3 — retention (post-beta OK)
`reminder_enabled {kind}`, `reminder_tapped {kind}`, `streak_milestone {days}`, `currency_changed {code}`.

## Vendor wiring (dispatch)
- Implement `dispatch()` → a privacy-respecting product-analytics provider (e.g. PostHog/Amplitude). Needs an API key (env) + an `identify(userId)` on login + `reset()` on logout. **Deferred:** key/account setup is a config task, not code risk; the seam is ready.
- Until wired, events buffer locally (dev console) — safe, no data leaves device.

## Privacy & compliance
- No PII in props (verified: current 5 events are clean). Money bucketed. Respect a future "analytics opt-out" toggle (add to Notification/Privacy settings). Document the provider + data in the privacy policy before enabling transport.

## Client vs server
- **Client `track()`** = funnel/feature adoption/retention (no PII, no amounts).
- **Server `IAuditLog`** = monetization/fraud/lifecycle (account- + payment-bound). Keep separate; don't duplicate billing truth on the client.

## Low-risk win identified
Instrumenting **Tier 1** events is purely additive `track()` calls over a no-op transport ⇒ **zero runtime risk**, high pre-beta value (~6–8 files). **Recommended as the first STEP 5 implementation increment** (pending approval, per "pause before large changes"). Vendor wiring + Tier 2/3 follow.
