# Web-First Product Strategy (Deliverable A)

> **Status: strategy memo. No production change.** Defines the reorientation to a web-first flagship. All new
> surfaces are flag-gated (`solver`, future `publicSpots`) and OFF in production ⇒ production byte-identical.
> Held branch `feature/v2-poker-platform`; no merge/deploy.

## The reorientation
T Poker's **web experience becomes the flagship product surface** — a serious, solver-grade workspace — while
the **mobile app becomes the companion** for learning, coaching, quick review, and progress. This is a product
+ IA decision, not a rewrite.

## Architecture reality + decision
There is **no separate web codebase**: "web" is the Expo **react-native-web export of the same RN app** (today
~95% platform-agnostic — only 4 narrow `Platform.OS==='web'` checks; no responsive layouts, hover, or
breakpoints). Per the locked constraints (no stack migration, no new infra, byte-identical-when-OFF, existing
seams), the flagship is built **inside the existing Expo app** as new, flag-gated, web-responsive surfaces —
**not** a separate Next.js stack. Trade-off accepted: react-native-web has ceilings vs a bespoke web stack, but
this ships a real solver workspace on one codebase with zero new infra and full release safety.

## Surface split

| Capability | Web (flagship) | Mobile (companion) |
|---|---|---|
| Solver workspace (range explorer, tree/node, deep inspection) | **Primary** — desktop multi-panel | Read/review via bottom-sheet |
| Range-table hover inspector | **Hover** (rich, keyboard-navigable) | Tap / long-press → bottom sheet |
| Compare mode, filters/search/sort, saved spots | **Primary** | Lightweight |
| Coach (AI hand review) | Available | **Primary companion** |
| Study / Spot & Decision trainer / mastery | Available | **Primary companion** |
| Quick review, streaks, progress | Secondary | **Primary companion** |
| Track / Bankroll / Groups / live games | Available both | Available both |

Principle: **web optimizes for depth + density + desktop interaction; mobile optimizes for focused, on-the-go
learning + review.** Consistent design language, not identical layouts.

## Mechanics
- **Flags:** new `solver` (OFF in `PROD_FLAGS`; ON in beta/dev) gates the entire solver workspace + entry points;
  future `publicSpots` (OFF, reserved) gates a shared spot library (design-only). Flags OFF ⇒ no new
  surface/route renders ⇒ production byte-identical.
- **Responsive layer:** a new `useResponsive()` hook (`useWindowDimensions` → `isMobile <768 / isTablet /
  isDesktop ≥1024`) + layout primitives (`SplitPane`, `HoverCard`, `DetailSheet`). The workspace is desktop-first
  multi-panel on large widths, single-column + bottom-sheet on mobile.
- **Routes (deep-link, web):** `/solver`, `/solver/:packId`, `/solver/:packId/:rangeId` (added to the existing
  React Navigation `linking` config, only surfaced when `solver` is ON).
- **Canonical data:** the workspace consumes the **T-Poker canonical solver-pack** format (see
  `solver-pack-architecture.md`) — a vendor-neutral, versioned, hashed, validated representation. Today's
  illustrative study ranges are a labelled fallback source; real solver depth (EV/equity/node-tree) lights up
  only when a verified pack is imported. **No fabricated solver values.**

## Honesty + limits (carried into every phase)
- Current range data is **action-frequency, illustrative** — clearly labelled; solver depth is additive +
  data-gated.
- Expo-web is a **client-rendered SPA**: deep SEO/SSR is a documented future ceiling (see
  `seo-discoverability-audit.md`); safe meta/OG/sitemap wins are in scope now.
- A bespoke web stack, real solver export adapters (GTOW/Pio/etc.), anti-bot/WAF + Redis, and counsel-final
  Terms are **external/out-of-scope** dependencies (tracked in the final report §K).

## What this memo does NOT change
No production behavior, no flags flipped, no foundations rebuilt, no infra. It sets the direction the
subsequent phases (canonical pack → workspace → premium polish → security headers → SEO → legal → future
architecture) execute against.
