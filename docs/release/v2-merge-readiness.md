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
| Ahead of `main` | 73 commits at last audit — grows each commit; check with `git rev-list --count origin/main..HEAD` |
| Behind `main` | **0** commits |
| merge-base vs `main` HEAD | identical (`5ece98d7b`) → **clean fast-forward, 0 conflicts** |
| Open PR | **#2** (`OPEN`) — github.com/taysh123/poker-home-games/pull/2 |
| Required reviews | none configured |
| CI | Vercel deployment check **pass** (preview built) |

Because `main` has not advanced since the branch diverged, the merge is conflict-free. Recommended strategy at
cutover time: **merge commit (`--no-ff`)** to preserve the full per-PR commit history and the PR boundary
(squash would collapse the granular content-platform + polish history — not recommended).

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
- [x] UI/UX polish program complete (design system, content + prod surfaces, a11y) + independent review resolved.
- [x] Backend security hardening subset implemented (JWT fail-closed + BCrypt 13 + CORS visibility) — `docs/review/security-abuse.md`, commit `5f3d1b8`.
- [ ] `prod-visible-changes.md` ledger reviewed and accepted (incl. the SessionListItem/GroupListItem chip restyle + the Profile **Terms of Service** link).
- [ ] Commercial readiness reviewed — master: `docs/release/commercial-readiness.md`; architecture: `docs/commercial/{billing,ai}-architecture.md`; the four review-track audits: `docs/review/{backend-readiness, cost-scalability, security-abuse, store-readiness}.md`.
- [ ] **HARD GATE — counsel-final Terms.** `apps/poker-mobile/public/terms.html` is a counsel-owned DRAFT and is linked from the **production-visible Profile screen**. Replace with attorney-approved copy **before merge** (not just before the paywall flip).
- [ ] Pre-flip dependencies accepted or resolved: real billing SDK + accounts/keys + localized pricing (gates the `paywall` flip — see `v2-deployment-checklist.md` + `commercial-readiness.md`); real AI vendor key/budget (gates retiring the coach demo).
- [ ] Final `tsc` + `jest` + `expo export -p web` green at the merge SHA.
- [ ] `v2-deployment-checklist.md` walked (env vars, migrations) + `rollback-recovery.md` safety net created.
- [ ] Backup tag + branch created at `main` pre-merge (rollback target).
