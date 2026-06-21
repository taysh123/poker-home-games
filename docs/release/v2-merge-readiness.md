# V2 Merge-Readiness Report

> **Status: HELD — NOT MERGED (per Decision 1).** This documents readiness only. No merge or deploy has
> been performed. `feature/v2-poker-platform` remains the active release branch; the polish program continues
> on it, and the final merge happens later after the full program + release review.

_Current as of the UI/UX polish program (Phases 0–7). Live gate counts: see `v2-qa-status.md` (currently
tsc clean · 367 jest / 42 suites · web export clean). Always re-run gates at the actual merge SHA before cutover._

## Branch / merge mechanics
| Check | Result |
|-------|--------|
| Source branch | `feature/v2-poker-platform` |
| Target | `main` |
| Ahead of `main` | 56 commits |
| Behind `main` | **0** commits |
| merge-base vs `main` HEAD | identical (`5ece98d7b`) → **clean fast-forward, 0 conflicts** |
| Open PR | **#2** (`OPEN`) — github.com/taysh123/poker-home-games/pull/2 |
| Required reviews | none configured |
| CI | Vercel deployment check **pass** (preview built) |

Because `main` has not advanced since the branch diverged, the merge is conflict-free. Recommended strategy at
cutover time: **merge commit (`--no-ff`)** to preserve the 56-commit / per-PR history and the PR boundary
(squash would collapse the granular content-platform history — not recommended).

## Local quality gates (current — re-verify at the merge SHA)
| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | clean (exit 0) |
| `npx jest` | **367 passed / 42 suites** |
| `npx expo export -p web` | clean (exit 0) |

## Production-safety (feature-flag) matrix
All V2 surfaces are gated OFF in production (`src/config/features.ts` → `PROD_FLAGS`): `content`, `mastery`,
`bankroll`, `study`, `coach`, `paywall`, `nav5`, `onboardingV2`, `retention`, `reminders`, `currencyPrefs`,
`polish`, `immersive`, `coachScreenshot`, `v2Splash` = **false**. Beta (`EXPO_PUBLIC_APP_VARIANT=beta`) and dev
(`__DEV__`) enable them. → With flags OFF, V2 **features** do not surface in production.

> ⚠️ **Note (Decision 2):** the polish program intentionally refines some **production-visible shared
> components** (visual only). Those changes are NOT behind flags and WILL change the live app's appearance once
> merged. They are tracked in `docs/release/prod-visible-changes.md`. This is a deliberate, approved release
> decision — not a regression. Content/mastery *feature* behavior remains gated OFF.

## Blockers to merge
- **None technical.** The only gate is the explicit hold (Decision 1): merge after the polish program,
  design-system review, final QA, and release review are complete.

## Pre-merge checklist (to complete before the eventual cutover)
- [ ] Polish program complete (Phases 1–6) + Phase 7 independent review findings resolved.
- [ ] `prod-visible-changes.md` ledger reviewed and accepted.
- [ ] Final `tsc` + `jest` + `expo export -p web` green at the merge SHA.
- [ ] `v2-deployment-checklist.md` walked (env vars, migrations, rollback).
- [ ] Backup tag + branch created at `main` pre-merge (rollback target).
