# T Poker — Commercial & Design Audit (Phase 6)

A product/monetization/conversion review of T Poker as a commercial subscription product, plus the
cross-app consistency pass. Independent multi-perspective audit (product + monetization + UX). Findings are
evidence-based (file references); no fabricated metrics.

## Headline
The monetization **plumbing** is genuinely well-engineered for pre-revenue: server-authoritative
entitlements, fail-closed AI-credit gating, a vendor-neutral provider seam, and disciplined honesty banners
(coach "Demo — Not Live AI", verbatim `MarketableAs` with a ≥95% solver-verified gate, "illustrative, not
solver output" study copy). It is **not** a student project in its architecture.

The commercial gaps are two, and they're linked:
1. **Everything monetizable is flag-OFF in production** (`paywall`, `coach`, `content`, `retention` = false) →
   there is effectively **no live revenue funnel** yet. Intentional and safe, but unproven.
2. **The paywall over-claimed** — it sold live AI, cloud sync, advanced analytics, and courses that don't
   exist. This was the one real honesty violation. **Fixed** (see below).

## Flag reality (live vs latent)
| Surface | Flag | Prod | Beta |
|---|---|---|---|
| Paywall / upgrade paths | `paywall` | OFF | OFF |
| AI Coach (labeled demo) | `coach` | OFF | ON (demo) |
| Content (lessons/quiz/packs) | `content` | OFF | ON |
| Retention (streaks/rank/achievements/reminders) | `retention`/`reminders` | OFF | ON |
→ No production user can reach a purchase today. The habit-loop (retention) is built but dark in prod.

## Fixed in Phase 6 (safe — copy/UI/consistency only; no billing/backend)
- **Paywall honesty (P0):** `PREMIUM_FEATURES` now carry a `comingSoon` flag; the paywall renders a **"Soon"
  chip** on every not-yet-live benefit and the hero subtitle no longer asserts immediate unlock
  (`features/premium/config.ts`, `ui/PaywallScreen.tsx`). The paywall can no longer present an unshipped
  benefit as available. (All five are `comingSoon` today — which is exactly why `paywall` is OFF.)
- **Coach out-of-credits dead-end (P1):** when `paywall` is off, the free-analysis-used path now sets an honest
  expectation ("more is coming with Premium") instead of a bare dead-end toast (`coach/ui/CoachInputScreen.tsx`).

## Remediation backlog — SAFE polish (future, branch-safe; not billing)
- Add Terms + Privacy links **on the paywall screen** (Privacy URL exists; Terms page may need authoring) and a
  "Cancel anytime" line next to the CTA — required for store IAP compliance before `paywall` is ever flipped.
- Give content/bankroll **empty states a secondary CTA** (e.g. "Try the Spot Trainer") so they convert instead
  of dead-ending — `EmptyState` already supports `action`.
- Onboarding **value-ladder beat** (non-promissory) so first-run users learn a paid tier is coming.
- Add a premium hook to `AchievementsScreen` once retention is surfaced.
- Comment the `COACH_CONFIG.provider` vs `SERVER_AUTHORITATIVE` interaction (mock-switch dead-path).

## Out of scope — real dependencies (NOT polish; do not fake)
- **Real billing provider** behind `IBillingProvider` (today `mockBillingProvider` always succeeds; `restore()`
  is a no-op). Cannot flip `paywall` honestly without it.
- **Localized store pricing** (replace hard-coded `$11.99`/`$79.99` with SDK-provided localized prices).
- **Real AI vendor** behind the coach provider seam (server `MockCoachAiProvider`); the "Not Live AI" banner
  must stay and the paywall must not sell live AI until then.
- **Implement** the sold benefits (cloud sync, premium content packs, advanced analytics, courses) before
  charging for them, or keep them `comingSoon`.
- **Validate + flip** `retention`/`reminders` to make the LTV/habit-loop live.

## Honesty verdict
After the Phase 6 fix, no surface presents an unshipped capability as live. The coach demo banner is accurate
(backend is a verified mock), marketable labels are verbatim + gated, and the paywall now flags every
not-yet-live benefit. The remaining commercial work is genuine product/billing build-out, not polish — and is
correctly gated OFF until done.
