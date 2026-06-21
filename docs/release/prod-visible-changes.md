# Production-visible changes ledger (V2 polish program)

Per Decision 2, the polish program may refine **production-visible** shared components/screens (visual only —
content/mastery *features* stay flag-gated OFF). Every such change is logged here with a before/after note so
the eventual merge is a deliberate, reviewable release of the live app's new appearance.

> Scope note: changes ONLY to flag-gated content surfaces (study/coach/premium/etc.) are NOT logged here —
> they don't affect production. This ledger is exclusively for components/screens that render in the current
> production app (e.g. shared `Card`/`Screen`/`PrimaryButton`/`EmptyState`/`SkeletonRow`, and screens like
> Home/Stats/Session/Groups/Profile).

| Date | Component / screen | Change | Before → After | Commit | Reviewed |
|------|--------------------|--------|----------------|--------|----------|
| 2026-06-21 | `motion/Celebration` (end-game confetti; prod via LocalSessionSummary) | Respect OS Reduce-Motion **unconditionally** (was gated behind the `polish` flag, so prod ignored it) | Reduce-Motion ON → confetti still played → **confetti suppressed** (correct a11y). Reduce-Motion OFF → unchanged | (phase 1) | spec review (frontend-architect/arch) |
| 2026-06-21 | `components/Badge.tsx` | Deleted (dead code, 0 importers) | No render impact (nothing imported it) | (phase 1) | grep-verified 0 importers |
| 2026-06-21 | `theme/colors.ts` | Added `successFaint`/`warningFaint`/`info`/`infoFaint` tokens | Additive new keys → existing usage byte-identical | (phase 1) | — |
| 2026-06-21 | `SessionListItem` (Home / AllSessions / Group lists) | LIVE pill + WIN/LOSS/EVEN badges → unified `Chip` | Hand-rolled pills (font 9, padH 5–7) → Chip (font 10, padH 8); LIVE now has a status dot; colors map to tone tokens (near-identical) | (phase 3) | self + Phase-1 review flagged these as the real prod chip target |
| 2026-06-21 | `GroupListItem` (Home / Groups lists) | Owner/Admin role pill → unified `Chip` (gold/neutral) | Hand-rolled pill → Chip (slightly larger, token-driven); P&L number left as colored text | (phase 3) | self |
