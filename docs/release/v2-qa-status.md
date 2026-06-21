# V2 QA Status (living log)

Running QA record for the V2 release on `feature/v2-poker-platform`. Updated per phase of the polish program.
No merge/deploy is performed (Decision 1).

## Baseline — entering the polish program (`03b811f`)
| Gate | Result | When |
|------|--------|------|
| `npx tsc --noEmit` | clean (0) | verified this session |
| `npx jest` | 354 passed / 41 suites | verified this session |
| `npx expo export -p web` | clean (0), web bundle built | verified this session |
| Governance audit (`audit_governance.py`) | 0 contradictions (workbook 0.8.1) | verified this session |
| Exporter (`export.py`) | 57 packs, 0 validation errors, ALL PACKS VALID | verified this session |

## Verification policy (this program)
Every increment runs: `tsc --noEmit` · `jest` (+ new proof tests) · `expo export -p web`. Content/mastery
flag-OFF functional check (no feature leak). Prod-visible component changes get a before/after note in
`prod-visible-changes.md`. Independent subagent review before major UI refactors and after each phase.

## Phase log
| Phase | Status | tsc | jest | export | Notes |
|-------|--------|-----|------|--------|-------|
| 0 — Release-readiness package | done | n/a (docs) | n/a | n/a | merge-readiness + deployment checklist + this log |
| 1 — Design System foundation | done | 0 | 362 / 42 | clean | spec + review + Chip/ErrorState(reuse)/StateView/ListRow + pure resolvers; Badge deleted; Celebration a11y (logged); +components/hooks jest globs |
| 2 — Content surfaces adoption | done | 0 | 362 / 42 | clean | PackCatalog/LessonModules/LessonReader/QuizRunner → StateView + ListRow + Chip + Screen-animated; retry wired. Flag-gated (no prod-visible change). Study-hub Stat + Coach chips folded into Phases 6/4. |
| 3 — Production surfaces refinement | pending | — | — | — | prod-visible |
| 4 — Coach grounding UI | done | 0 | 365 / 42 | clean | Honest standalone "Grounded references" surface (safe_to_assert only, tier+citation+caveat, NO hand linkage); allAssertions gated accessor; CoachResult trust chips → Chip; coach-provider contract untouched. Flag-gated. |
| 5 — Quiz/learning/mastery UX | pending | — | — | — | mastery-flag-gated |
| 6 — Cross-app consistency + commercial review | pending | — | — | — | |
| 7 — Verification + independent review | pending | — | — | — | |

## Open risks
- Prod-visible refinement (Decision 2) changes the live app's appearance on merge — tracked + reviewed, not gated.
- 0.8.1 handoff/manifest docs still pending from content team (does not block app QA).
