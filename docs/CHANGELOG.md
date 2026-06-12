# T Poker — Feature History

The complete shipped-feature ledger and phase history, moved out of the README.
Newest entries at the bottom of each table.

## Shipped Features

| Status | Feature |
|--------|---------|
| ✅ | Full auth (email/password + Google OAuth) |
| ✅ | Group management with roles |
| ✅ | Live session tracking |
| ✅ | Settlement engine |
| ✅ | Hand history |
| ✅ | Statistics & leaderboard |
| ✅ | Session/group invite links |
| ✅ | CSV export + PDF share card |
| ✅ | Player profiles + H2H stats |
| ✅ | Session recaps with narrative highlights |
| ✅ | Streak tracking (current + longest win streak) |
| ✅ | Achievements & badge system (14 achievements) |
| ✅ | Skeleton loading on all screens |
| ✅ | Onboarding first-run carousel |
| ✅ | Response compression (Brotli/gzip) |
| ✅ | Period-based stats (This Week / This Month / All Time) |
| ✅ | In-app notification inbox (session end, settlement paid, group invite) |
| ✅ | Group rivalries (top 5 most-played pairings per group) |
| ✅ | Cross-group activity feed on home screen |
| ✅ | Group leaderboard period filter (week/month/all-time) |
| ✅ | AllSessions group filter chips |
| ✅ | Per-group P&L displayed on all group list items |
| ✅ | Total time played stat (period-aware) |
| ✅ | Production hardening — full middleware pipeline (JWT, rate limits, exception handling) |
| ✅ | Cash transfer engine — greedy debt-minimization for guest + mixed sessions |
| ✅ | Social home feed — date-bucketed activity + colored icon tinting |
| ✅ | W/L/E result badges on session list items across all screens |
| ✅ | Group rivalries promoted + leaderboard top-3 medal accents |
| ✅ | Player profile identity: P&L hero, performance avatar ring, H2H verdict badge |
| ✅ | Session winner spotlight (spring animation + gold glow) + live leader chip glow |
| ✅ | Achievement progress text for locked achievements |
| ✅ | **Guest mode** — full local game loop without an account (on-device, offline) |
| ✅ | TypeScript settlement engine port with Jest test suite |
| ✅ | Reanimated 4 motion system (press-scale + haptics, shimmer skeletons, count-ups) |
| ✅ | Confetti celebrations, glass tab bar/sheets (iOS), swipeable onboarding |
| ✅ | Deep-link invite continuation after sign-in (pending-invite handoff) |
| ✅ | Privacy policy page + EAS submit scaffold + store release checklist |
| ✅ | **The Final Count** — redesigned end-game flow (clear final-stack entry, inline balance indicator, explicit override, finality framing) in both local and group sessions |
| ✅ | **Velvet Table** visual system — DM Serif Display accents, ambient gradient vignettes, deep navy base, spacing/radius tokens, ScreenHeader/Card/SectionTitle components, gold-gradient CTAs, tab-icon spring pop |

## Phase History

| Phases | Focus |
|--------|-------|
| 1–10 | Project scaffold, auth (JWT + Google OAuth), session CRUD, buy-in/cash-out |
| 11–20 | Group management, roles, invitations, settlements, hand history |
| 21–30 | CSV export, PDF share card, player profiles, H2H stats, session recaps |
| 31–40 | Streak tracking, skeleton loaders, entrance animations, onboarding, achievements |
| 41–50 | Notifications, rivalries, cross-group activity feed, leaderboard periods, per-group P&L |
| 51–60 | Production hardening, Railway deployment fixes, healthcheck, middleware pipeline |
| 61–70 | Cash transfer engine, social home feed, leaderboard medals, profile identity polish, session winner spotlight, achievement progress |
| 71+ | Guest mode (local-first games, no login wall), TS settlement port + Jest, Reanimated 4 motion system, celebrations, glass UI, store-readiness scaffold |
| 80+ | The Final Count end-game redesign, Velvet Table visual system (serif display type, ambient vignettes, design tokens, unified components), professional README |
| 90+ | Social layer (unified Avatar + emoji/color identity, activity tap-through + pagination, weekly digest card, image share cards), store readiness (notifications plugin, v1.1.0, expo-doctor clean, EAS preview build), local-first Tournament Mode v1 (prize pools, blind clock, bust-outs, rebuys, podium payouts) |
| 95+ | Tournament-first UI (dual entry cards, rich wizard mode cards), store asset production (icons, feature graphic, 18 store-size screenshots), complete Play/App Store release guide, mobile-first audit + small-screen fixes, post-v1.1 roadmap |
