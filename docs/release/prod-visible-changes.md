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
| 2026-06-21 | `SessionListItem` (Home / AllSessions / Group lists) | LIVE pill + WIN/LOSS/EVEN badges → unified `Chip` | Visible restyle (not byte-identical): radius 4–5→10, font 9→10, padH 5–7→8; LIVE gains a leading status dot; tone colors token-mapped. Most-noticeable Phase-3 prod change → attach before/after to the merge PR | (phase 3) | self + Phase-1 review |
| 2026-06-21 | `Chip` `neutral` tone (SessionListItem EVEN, GroupListItem Admin, + flag-gated chips) | Neutral chip text `textMuted` → `textHigh` | AA contrast fix: 10px bold neutral label was ~3:1 → now meets ≥4.5:1; neutral chips read slightly brighter | (phase 7) | Phase-7 a11y review |
| 2026-06-21 | `GroupListItem` (Home / Groups lists) | Owner/Admin role pill → unified `Chip` (gold/neutral) | Hand-rolled pill → Chip (slightly larger, token-driven); P&L number left as colored text | (phase 3) | self |
| 2026-06-21 | `HomeScreen` | Entrance animations + live pulse now respect OS Reduce Motion | Reduce-Motion ON → hero/content fade-in + live-dot pulse played → now render steady (instant final state). Reduce-Motion OFF → unchanged | (phase 3) | self (a11y/frontend/perf) |
| 2026-06-21 | `useScreenEntrance` (AllSessions, PendingSettlements, Invitations, Notifications, GroupsList) | Shared entrance hook respects Reduce Motion | Reduce-Motion ON → 5 screens no longer fade/slide on focus (instant). OFF → unchanged | `ce894fb` | self (a11y/frontend) |
| 2026-06-21 | `StatsScreen` | Entrance animation respects Reduce Motion | Reduce-Motion ON → no fade/slide (instant). OFF → unchanged | (phase 3) | self (a11y) |
| 2026-06-21 | `SessionScreen` | End-game winner spotlight spring respects Reduce Motion | Reduce-Motion ON → winner row no longer springs (instant final scale). OFF → unchanged | (phase 3) | self (a11y) |
| 2026-06-21 | Profile / Bankroll | (no change) | Audited — no animations; already motion-safe | — | self |
| 2026-06-21 | `ProfileScreen` (About & Support) | Added a **Terms of Service** row opening `terms.html`, under Privacy Policy | One new tappable row (icon + label + chevron); opens the counsel-owned Terms DRAFT. ⚠ Finalize Terms copy before merge (HARD GATE in merge-readiness) | `a0c0ee4` | self (legal surface) |
| 2026-06-24 | `motion/AnimatedNumber` (Home hero P&L, Stats, summaries) | Count-up now respects OS Reduce Motion | Reduce-Motion ON → numbers counted up every render → **snap to final value** (correct a11y). OFF → unchanged | (audit phase) | self (a11y; audit T-A) |
| 2026-06-24 | `HomeScreen` entrance | Entrance fade is now **once-per-mount** (the `hasAnimated` guard was scoped behind the OFF `polish` flag, so prod re-faded on every tab focus) | Returning to the Home tab re-played the hero/content fade → now renders steady after first mount. First mount unchanged | (audit phase) | self (bug; audit T-A) |
| 2026-06-24 | `components/Toast` (app-wide feedback) | Screen-reader announcement added (`announceForAccessibility` + `accessibilityLiveRegion` + `role=alert`) | VoiceOver/TalkBack never announced toasts (container is `pointerEvents:none`) → now announced. No visual change | (audit phase) | self (a11y; audit T-A) |
| 2026-06-24 | `components/ActionSheet`, icon-only buttons (AllSessions/GroupsList/LocalSession) | Added `accessibilityRole`/`accessibilityLabel`/`accessibilityViewIsModal` | Icon-only controls were unlabeled for AT; sheet didn't trap AT focus → now labeled + modal. No visual change | (audit phase) | self (a11y; audit T-A) |
| 2026-06-24 | `components/DealInOverlay` (NewGame / LocalNewGame) | Stop the gold-sweep `Animated.loop` on unmount (was leaked; only the timeout was cleared) | Loop kept ticking after the overlay dismissed until GC → now stopped on cleanup. No visible change | (audit phase) | self (bug; audit T-A) |
