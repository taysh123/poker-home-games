# Landing / Pricing Page (Subsystem 4, Phase 2, web-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a web-only, two-sided hook-forward landing/pricing page that presents the free club tool, leads into Premium Study, shows honest pricing (monthly/yearly) with "Soon" chips on non-live benefits, and routes logged-out web visitors to it at `/` while leaving native, logged-in, and deep-link (`/join/*`) flows untouched.

**Architecture:** The landing page's copy/pricing/FAQ are extracted into a **pure, importable content module** (`features/landing/landingContent.ts`) so they can be tested deterministically and shared with the page render. A **pure routing-decision function** (`features/landing/landingRouting.ts`) decides whether a given `{ platform, isAuthed, path }` should see the Landing screen — tested in isolation, then consumed by `AppNavigator`. A new **pending-checkout stash** (`utils/pendingCheckout.ts`) mirrors `utils/pendingInvite.ts` so a logged-out pricing CTA survives the sign-up round-trip. `LandingScreen.tsx` renders only on web, consumes the content module and the existing Velvet-Table primitives, and calls `PremiumContext.purchase()` (built in Subsystem 3) for signed-in users or stashes a checkout intent + routes to sign-up otherwise. The Subsystem-3 dependency is referenced, never duplicated; all logic in THIS plan (content, routing decision, pending-checkout) is independently testable without live Stripe.

**Tech Stack:** Expo SDK 54 (React Native 0.81 + react-native-web 0.21), TypeScript, React Navigation 7 (`linking`), AsyncStorage, Jest (`jest-expo` 54) + `@testing-library/react-native` (added in Task 0) for the render smoke test, `expo-linear-gradient`, `@expo/vector-icons` (Ionicons — SVG glyphs, no emoji).

---

## File Structure

**New files**
- `apps/poker-mobile/src/utils/pendingCheckout.ts` — pending-checkout-intent stash (mirror of `pendingInvite.ts`): `savePendingCheckout(plan)`, `consumePendingCheckout()`, 15-min TTL, AsyncStorage key `tpoker.pendingCheckout`.
- `apps/poker-mobile/src/utils/__tests__/pendingCheckout.test.ts` — stash / read / clear-on-read / TTL-expiry / corrupt-payload unit tests.
- `apps/poker-mobile/src/features/landing/landingContent.ts` — pure data module: hero copy, club-tool value props, Premium Study section (uses the exact `premium_study` copy), pricing rows derived from `PRICING`, FAQ Q&A, footer legal links + age/gambling disclaimer, and the `landingPlans()` selector that tags each pricing benefit with its `comingSoon` flag.
- `apps/poker-mobile/src/features/landing/__tests__/landingContent.test.ts` — content-shape + honesty tests (exact `premium_study` copy present; exactly one non-Soon paid benefit; legal links + disclaimer present; pricing numbers match `PRICING`).
- `apps/poker-mobile/src/features/landing/landingRouting.ts` — pure `resolveWebLanding({ platform, isAuthed, path })` decision + `isDeepLinkPath(path)` helper.
- `apps/poker-mobile/src/features/landing/__tests__/landingRouting.test.ts` — gating matrix (logged-out web `/` → Landing; logged-in → app; native → never; `/join/*` → bypass).
- `apps/poker-mobile/src/screens/LandingScreen.tsx` — the web-only page (renders `null` off-web), composed from `landingContent` + Velvet-Table primitives.
- `apps/poker-mobile/src/screens/__tests__/LandingScreen.test.tsx` — render smoke test (web) via `@testing-library/react-native`: hero + pricing + Soon chips + legal footer render; NO purchase CTA appears for a Soon benefit; a11y roles/labels present.

**Modified files**
- `apps/poker-mobile/jest.config.js` — add `src/screens/__tests__/**/*.test.tsx` to `testMatch` so the render test runs.
- `apps/poker-mobile/package.json` — add `@testing-library/react-native` devDependency (Task 0).
- `apps/poker-mobile/src/navigation/AppNavigator.tsx` — import `LandingScreen` + `resolveWebLanding`; register `Landing` route (web, guest tree, first screen); add `Landing: 'landing'` (or `/`) to `linking.config.screens`; ensure `/join/*` keeps bypassing; wire the null→user pending-checkout resume alongside the existing pending-invite resume.

---

## Conventions (read before starting)

- **Semantic tokens only.** Import from `theme/colors`, `theme/typography`, `theme/spacing`, `theme/radii`. NEVER a raw hex literal in a component (`legalSurfaces`-style honesty tests and review will catch it).
- **SVG icons only** via `@expo/vector-icons` Ionicons. No emoji as iconography in new surfaces.
- **Reuse primitives:** `components/Screen`, `components/Card`, `components/PrimaryButton`, `components/Chip` (the single Soon-chip primitive — `<Chip label="Soon" tone="neutral" />`, matches `PaywallScreen`), `components/BrandHeader` (logo home anchor). Render any avatar/initials through `components/Avatar` if used.
- **Subsystem-3 reference (do NOT build here):** `usePremium()` from `features/premium/state/PremiumContext` exposes `{ isPremium, purchasing, purchase(productId) }`. Product IDs come from `PRICING` in `features/premium/config.ts` (`PRICING.monthly.productId`, `PRICING.yearly.productId`). The live paid benefit copy lives at `PREMIUM_FEATURES` key `premium_study` once Subsystem 3 adds it; this plan hardcodes the agreed string in `landingContent.ts` AND reads `PREMIUM_FEATURES` defensively (so the two stay consistent). If `premium_study` is not yet in `PREMIUM_FEATURES` when this runs, the content module still works (it owns the canonical string); a test asserts the string equality.
- **The exact Premium Study benefit copy (verbatim, from §7 / `features/premium/config.ts`):**
  `Full lesson library — every study pack · all quizzes · unlimited Spot Trainer`
- **Honesty gate (§10):** the landing NEVER renders a purchase/CTA affordance attached to a `comingSoon` benefit. Only `premium_study` is live; every other listed premium feature shows a "Soon" chip and no buy path.
- **a11y (§11 priority order):** 4.5:1 contrast (tokens already satisfy this), visible focus rings (web — `accessibilityRole`/`accessible`), `prefers-reduced-motion` (use `hooks/useReducedMotion`), ≥44×44 touch targets, reserve space (CLS < 0.1 — no late-injected blocks), no horizontal scroll, T Poker logo anchor (`BrandHeader`/logo asset).
- **Web-safe dialogs:** `Alert.alert` is a no-op on web. Not expected here, but if any confirm is added, use `utils/confirm.ts`.
- **Commit discipline:** one commit per task (red→green), exact messages given.

---

## Task 0: Test tooling — enable component render tests

**Files:**
- Modify: `apps/poker-mobile/package.json` (devDependencies)
- Modify: `apps/poker-mobile/jest.config.js:4-13` (testMatch)

- [ ] **Step 1: Add the render-test library**

Run (from `apps/poker-mobile`):
`npm install --save-dev --save-exact @testing-library/react-native@12.9.0`

Rationale: `react-test-renderer` already ships transitively, but `@testing-library/react-native` gives `render`, `screen.getByText`, and accessibility queries (`getByRole`) needed for the LandingScreen smoke + a11y assertions. Version 12.9.0 is compatible with React 19 / RN 0.81 / jest-expo 54.

- [ ] **Step 2: Allow `.test.tsx` under `src/screens/__tests__`**

Modify `apps/poker-mobile/jest.config.js` — add one entry to `testMatch` (keep all existing entries):

```js
/** Pure-logic tests + the web-only landing render smoke test. */
module.exports = {
  preset: 'jest-expo',
  testMatch: [
    '**/src/local/__tests__/**/*.test.ts',
    '**/src/utils/__tests__/**/*.test.ts',
    '**/src/features/**/__tests__/**/*.test.ts',
    '**/src/api/__tests__/**/*.test.ts',
    '**/src/content/__tests__/**/*.test.ts',
    '**/src/analytics/__tests__/**/*.test.ts',
    '**/src/components/__tests__/**/*.test.ts',
    '**/src/hooks/__tests__/**/*.test.ts',
    '**/src/screens/__tests__/**/*.test.tsx',
  ],
};
```

- [ ] **Step 3: Verify the suite still runs green (no new tests yet)**

Run: `npx jest`
Expected: PASS — existing suites unchanged; no `src/screens/__tests__` files exist yet so the new glob matches nothing.

- [ ] **Step 4: Commit**

```bash
git add apps/poker-mobile/package.json apps/poker-mobile/package-lock.json apps/poker-mobile/jest.config.js
git commit -m "test(landing): add @testing-library/react-native + screens .test.tsx matcher"
```

---

## Task 1: `pendingCheckout` stash (mirror of `pendingInvite`)

**Files:**
- Create: `apps/poker-mobile/src/utils/pendingCheckout.ts`
- Test: `apps/poker-mobile/src/utils/__tests__/pendingCheckout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/poker-mobile/src/utils/__tests__/pendingCheckout.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { savePendingCheckout, consumePendingCheckout } from '../pendingCheckout';

beforeEach(async () => { await AsyncStorage.clear(); jest.useRealTimers(); });

describe('pendingCheckout stash', () => {
  it('round-trips a stashed plan', async () => {
    await savePendingCheckout('yearly');
    expect(await consumePendingCheckout()).toBe('yearly');
  });

  it('is single-use — consume clears it', async () => {
    await savePendingCheckout('monthly');
    expect(await consumePendingCheckout()).toBe('monthly');
    expect(await consumePendingCheckout()).toBeNull();
  });

  it('returns null when nothing is stashed', async () => {
    expect(await consumePendingCheckout()).toBeNull();
  });

  it('expires after the 15-minute TTL', async () => {
    const realNow = Date.now;
    const base = 1_700_000_000_000;
    Date.now = () => base;
    await savePendingCheckout('yearly');
    Date.now = () => base + 15 * 60 * 1000 + 1; // 1ms past TTL
    expect(await consumePendingCheckout()).toBeNull();
    Date.now = realNow;
  });

  it('fails closed on a corrupt payload', async () => {
    await AsyncStorage.setItem('tpoker.pendingCheckout', '{not json');
    expect(await consumePendingCheckout()).toBeNull();
  });

  it('rejects an unknown plan value', async () => {
    await AsyncStorage.setItem(
      'tpoker.pendingCheckout',
      JSON.stringify({ plan: 'bogus', at: Date.now() }),
    );
    expect(await consumePendingCheckout()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/utils/__tests__/pendingCheckout.test.ts`
Expected: FAIL — `Cannot find module '../pendingCheckout'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/poker-mobile/src/utils/pendingCheckout.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * When a logged-out visitor taps a pricing CTA, we stash the chosen plan here,
 * send them to sign-up, and resume checkout right after they authenticate.
 * Mirrors utils/pendingInvite.ts (TTL + single-use + fail-closed).
 */

const KEY = 'tpoker.pendingCheckout';
const TTL_MS = 15 * 60 * 1000;

export type CheckoutPlan = 'monthly' | 'yearly';
type Stashed = { plan: CheckoutPlan; at: number };

export async function savePendingCheckout(plan: CheckoutPlan): Promise<void> {
  try {
    const payload: Stashed = { plan, at: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // non-critical
  }
}

/** Reads AND clears the pending checkout. Null if missing, expired, or invalid. */
export async function consumePendingCheckout(): Promise<CheckoutPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    const data = JSON.parse(raw) as Stashed;
    const planOk = data?.plan === 'monthly' || data?.plan === 'yearly';
    if (!planOk || typeof data.at !== 'number' || Date.now() - data.at > TTL_MS) return null;
    return data.plan;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/utils/__tests__/pendingCheckout.test.ts`
Expected: PASS — all 6 cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/utils/pendingCheckout.ts apps/poker-mobile/src/utils/__tests__/pendingCheckout.test.ts
git commit -m "feat(landing): pendingCheckout stash mirroring pendingInvite (TTL, single-use, fail-closed)"
```

---

## Task 2: Pure landing content module (copy, pricing, FAQ, legal) + honesty tests

**Files:**
- Create: `apps/poker-mobile/src/features/landing/landingContent.ts`
- Test: `apps/poker-mobile/src/features/landing/__tests__/landingContent.test.ts`

**Module contract (`landingContent.ts`):**

```ts
export type LandingValueProp = { icon: IoniconName; title: string; body: string };
export type LandingPlan = {
  key: 'monthly' | 'yearly';
  productId: string;     // from PRICING
  price: string;         // display string from PRICING ($11.99 / $99.99)
  cadence: string;       // 'per month' / 'per year'
  subline?: string;      // yearly: '$8.33/mo · save 30%'
  highlighted: boolean;  // yearly true (best value)
};
export type LandingBenefit = { title: string; comingSoon: boolean };
export type LandingFaq = { q: string; a: string };
export type LandingLegalLink = { label: string; href: string };
```

Exports:
- `PREMIUM_STUDY_BENEFIT: string` — the canonical verbatim copy.
- `LANDING_HERO`, `LANDING_CLUB_VALUE: LandingValueProp[]`, `LANDING_STUDY_VALUE: LandingValueProp[]`.
- `landingPlans(): LandingPlan[]` — built from `PRICING`.
- `landingBenefits(): LandingBenefit[]` — Premium Study (`comingSoon:false`) first, then the other premium features as `comingSoon:true` (sourced from `PREMIUM_FEATURES` when present, else a static honest fallback list; PACK-10 / "Advanced GTO" excluded from advertised value).
- `LANDING_FAQ: LandingFaq[]`, `LANDING_LEGAL_LINKS: LandingLegalLink[]` (Privacy → `/privacy.html`, Terms → `/terms.html`), `LANDING_DISCLAIMER: string` (contains `18+` and `not a gambling product`).

- [ ] **Step 1: Write the failing test**

Create `apps/poker-mobile/src/features/landing/__tests__/landingContent.test.ts`:

```ts
import { PRICING, PREMIUM_FEATURES } from '../../premium/config';
import {
  PREMIUM_STUDY_BENEFIT,
  LANDING_HERO,
  landingPlans,
  landingBenefits,
  LANDING_FAQ,
  LANDING_LEGAL_LINKS,
  LANDING_DISCLAIMER,
} from '../landingContent';

describe('landing content — honesty + correctness', () => {
  it('uses the exact Premium Study benefit copy from §7', () => {
    expect(PREMIUM_STUDY_BENEFIT).toBe(
      'Full lesson library — every study pack · all quizzes · unlimited Spot Trainer',
    );
  });

  it('keeps the §7 copy consistent with PREMIUM_FEATURES when premium_study is present', () => {
    const live = PREMIUM_FEATURES.find(f => f.key === 'premium_study');
    if (live) expect(live.desc).toBe(PREMIUM_STUDY_BENEFIT); // guards drift once Subsystem 3 lands
  });

  it('exposes a hero with a non-empty headline and subhead', () => {
    expect(LANDING_HERO.headline.length).toBeGreaterThan(0);
    expect(LANDING_HERO.subhead.length).toBeGreaterThan(0);
  });

  it('derives both plans from PRICING with the yearly highlighted', () => {
    const plans = landingPlans();
    const monthly = plans.find(p => p.key === 'monthly')!;
    const yearly = plans.find(p => p.key === 'yearly')!;
    expect(monthly.price).toBe(PRICING.monthly.price);     // $11.99
    expect(yearly.price).toBe(PRICING.yearly.price);       // $99.99
    expect(monthly.productId).toBe(PRICING.monthly.productId);
    expect(yearly.productId).toBe(PRICING.yearly.productId);
    expect(yearly.highlighted).toBe(true);
    expect(monthly.highlighted).toBe(false);
    expect(yearly.subline).toMatch(/save 30%/);
  });

  it('lists exactly one live (non-Soon) paid benefit — Premium Study', () => {
    const benefits = landingBenefits();
    const live = benefits.filter(b => !b.comingSoon);
    expect(live).toHaveLength(1);
    expect(live[0].title).toBe(PREMIUM_STUDY_BENEFIT);
    expect(benefits.some(b => b.comingSoon)).toBe(true); // at least one honest Soon
  });

  it('never advertises PACK-10 / Advanced GTO as paid value', () => {
    const titles = landingBenefits().map(b => b.title.toLowerCase());
    expect(titles.some(t => t.includes('advanced gto'))).toBe(false);
  });

  it('has FAQ entries with both question and answer', () => {
    expect(LANDING_FAQ.length).toBeGreaterThanOrEqual(3);
    LANDING_FAQ.forEach(f => {
      expect(f.q.length).toBeGreaterThan(0);
      expect(f.a.length).toBeGreaterThan(0);
    });
  });

  it('footer links to privacy + terms and shows the 18+/not-gambling disclaimer', () => {
    const hrefs = LANDING_LEGAL_LINKS.map(l => l.href);
    expect(hrefs).toContain('/privacy.html');
    expect(hrefs).toContain('/terms.html');
    expect(LANDING_DISCLAIMER).toMatch(/18\+/);
    expect(LANDING_DISCLAIMER.toLowerCase()).toMatch(/not a gambling product/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/landing/__tests__/landingContent.test.ts`
Expected: FAIL — `Cannot find module '../landingContent'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/poker-mobile/src/features/landing/landingContent.ts`:

```ts
import type { Ionicons } from '@expo/vector-icons';
import { PRICING, PREMIUM_FEATURES } from '../premium/config';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type LandingValueProp = { icon: IoniconName; title: string; body: string };
export type LandingPlan = {
  key: 'monthly' | 'yearly';
  productId: string;
  price: string;
  cadence: string;
  subline?: string;
  highlighted: boolean;
};
export type LandingBenefit = { title: string; comingSoon: boolean };
export type LandingFaq = { q: string; a: string };
export type LandingLegalLink = { label: string; href: string };

/** The ONE live paid benefit — verbatim from §7 / features/premium/config.ts. */
export const PREMIUM_STUDY_BENEFIT =
  'Full lesson library — every study pack · all quizzes · unlimited Spot Trainer';

export const LANDING_HERO = {
  headline: 'Run the night. Settle in one tap.',
  subhead:
    'T Poker is the free home-game club tool — cash games and tournaments, ' +
    'buy-ins, a blind clock, and instant settlements. No account needed to start.',
  primaryCta: 'Start a free game',
  secondaryCta: 'See Premium',
};

/** Free club tool — the differentiator / acquisition hook. */
export const LANDING_CLUB_VALUE: LandingValueProp[] = [
  { icon: 'play-circle', title: 'Cash & tournaments', body: 'Track every buy-in and cash-out, or run a tournament with a blind clock and prize pool.' },
  { icon: 'people',      title: 'Built for your crew', body: 'Groups, lifetime stats, leaderboards, and head-to-head — your regular game, organized.' },
  { icon: 'flash',       title: 'One-tap settlements', body: 'We do the debt math. Everyone knows who owes who the moment the night ends.' },
];

/** Get better between sessions — Premium Study. */
export const LANDING_STUDY_VALUE: LandingValueProp[] = [
  { icon: 'school',      title: 'Study packs',    body: 'Structured lessons on cash, tournaments, push/fold, and the mental game.' },
  { icon: 'help-circle', title: 'Daily quizzes',  body: 'Quick reps that build a streak — free every day, unlimited with Premium.' },
  { icon: 'locate',      title: 'Spot Trainer',   body: 'Drill real preflop spots until the right play is automatic.' },
];

export function landingPlans(): LandingPlan[] {
  return [
    {
      key: 'monthly',
      productId: PRICING.monthly.productId,
      price: PRICING.monthly.price,
      cadence: 'per month',
      highlighted: false,
    },
    {
      key: 'yearly',
      productId: PRICING.yearly.productId,
      price: PRICING.yearly.price,
      cadence: 'per year',
      subline: `${PRICING.yearly.perMonth}/mo · save ${PRICING.yearly.savePct}%`,
      highlighted: true,
    },
  ];
}

/**
 * Pricing-card benefit list. Premium Study is the only live (purchasable) value;
 * every other premium feature is shown honestly with a Soon chip and no buy path.
 * Sourced from PREMIUM_FEATURES when available (drops premium_study, which we lead
 * with explicitly, and never advertises Advanced GTO / PACK-10). Falls back to a
 * static honest list if the catalog has not yet been extended by Subsystem 3.
 */
export function landingBenefits(): LandingBenefit[] {
  const soonFromCatalog = PREMIUM_FEATURES
    .filter(f => f.key !== 'premium_study' && f.comingSoon)
    .filter(f => !/advanced gto/i.test(f.title))
    .map(f => ({ title: f.title, comingSoon: true as const }));

  const soon: LandingBenefit[] = soonFromCatalog.length
    ? soonFromCatalog
    : [
        { title: 'AI Coach', comingSoon: true },
        { title: 'Advanced bankroll analytics', comingSoon: true },
        { title: 'Cloud sync', comingSoon: true },
      ];

  return [{ title: PREMIUM_STUDY_BENEFIT, comingSoon: false }, ...soon];
}

export const LANDING_FAQ: LandingFaq[] = [
  { q: 'Is the home-game tool really free?', a: 'Yes. Running cash games and tournaments, settlements, groups, and stats are free — no account required to start.' },
  { q: 'What does Premium include today?', a: `${PREMIUM_STUDY_BENEFIT}. Other premium features are marked "Soon" and are never charged for until they ship.` },
  { q: 'Can I cancel anytime?', a: 'Yes — subscriptions renew until cancelled, and you can cancel anytime from your account.' },
  { q: 'Is this real-money gambling?', a: 'No. T Poker is a tracking and study tool for private home games. It is not a gambling product and handles no wagers.' },
];

export const LANDING_LEGAL_LINKS: LandingLegalLink[] = [
  { label: 'Privacy', href: '/privacy.html' },
  { label: 'Terms', href: '/terms.html' },
];

export const LANDING_DISCLAIMER = '18+ · not a gambling product';
```

> Note: `landingContent.ts` is a `.ts` (not `.tsx`) module but uses a `React.ComponentProps` type for icon names. Add `import type React from 'react';` at the top if `tsc` flags the `React` namespace; the icon-name type only needs the type import, no JSX.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/landing/__tests__/landingContent.test.ts`
Expected: PASS — all cases green (the `premium_study` consistency test is a no-op until Subsystem 3 adds the catalog entry, then it actively guards drift).

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/features/landing/landingContent.ts apps/poker-mobile/src/features/landing/__tests__/landingContent.test.ts
git commit -m "feat(landing): pure landing content module (hero, pricing, benefits, FAQ, legal) + honesty tests"
```

---

## Task 3: Pure routing-decision function (`resolveWebLanding`)

**Files:**
- Create: `apps/poker-mobile/src/features/landing/landingRouting.ts`
- Test: `apps/poker-mobile/src/features/landing/__tests__/landingRouting.test.ts`

**Contract:**

```ts
type RouteInput = { platform: 'web' | 'ios' | 'android'; isAuthed: boolean; path: string };
function isDeepLinkPath(path: string): boolean;     // true for /join/group/* and /join/session/*
function resolveWebLanding(input: RouteInput): boolean; // true ⇒ show Landing
```

Rules (from §8): show Landing only when `platform === 'web'` AND `!isAuthed` AND the path is the site root (`/`, empty, or `/landing`) AND it is NOT a deep link. Native always false. Authed always false. `/join/*` always false (deep links bypass Landing).

- [ ] **Step 1: Write the failing test**

Create `apps/poker-mobile/src/features/landing/__tests__/landingRouting.test.ts`:

```ts
import { resolveWebLanding, isDeepLinkPath } from '../landingRouting';

describe('isDeepLinkPath', () => {
  it('flags join deep links', () => {
    expect(isDeepLinkPath('/join/group/abc123')).toBe(true);
    expect(isDeepLinkPath('/join/session/xyz')).toBe(true);
  });
  it('does not flag the root or landing', () => {
    expect(isDeepLinkPath('/')).toBe(false);
    expect(isDeepLinkPath('/landing')).toBe(false);
  });
});

describe('resolveWebLanding', () => {
  it('shows Landing for a logged-out web visitor at root', () => {
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '/' })).toBe(true);
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '' })).toBe(true);
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '/landing' })).toBe(true);
  });

  it('sends a logged-in web user to the app, not Landing', () => {
    expect(resolveWebLanding({ platform: 'web', isAuthed: true, path: '/' })).toBe(false);
  });

  it('bypasses Landing for deep links even when logged out', () => {
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '/join/group/abc' })).toBe(false);
    expect(resolveWebLanding({ platform: 'web', isAuthed: false, path: '/join/session/abc' })).toBe(false);
  });

  it('never shows Landing on native', () => {
    expect(resolveWebLanding({ platform: 'ios', isAuthed: false, path: '/' })).toBe(false);
    expect(resolveWebLanding({ platform: 'android', isAuthed: false, path: '/' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/features/landing/__tests__/landingRouting.test.ts`
Expected: FAIL — `Cannot find module '../landingRouting'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/poker-mobile/src/features/landing/landingRouting.ts`:

```ts
/**
 * Pure decision for whether a visitor should see the web-only Landing page.
 * Kept side-effect-free so it is unit-testable without React Navigation; the
 * navigator consumes it (see AppNavigator). Deep links (/join/*) bypass Landing.
 */
export type RoutePlatform = 'web' | 'ios' | 'android';
export type RouteInput = { platform: RoutePlatform; isAuthed: boolean; path: string };

export function isDeepLinkPath(path: string): boolean {
  return /^\/?join\/(group|session)\//.test(path);
}

export function resolveWebLanding({ platform, isAuthed, path }: RouteInput): boolean {
  if (platform !== 'web') return false;
  if (isAuthed) return false;
  if (isDeepLinkPath(path)) return false;
  const normalized = path.replace(/^\//, '').replace(/\/$/, '');
  return normalized === '' || normalized === 'landing';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/features/landing/__tests__/landingRouting.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/features/landing/landingRouting.ts apps/poker-mobile/src/features/landing/__tests__/landingRouting.test.ts
git commit -m "feat(landing): pure resolveWebLanding gating (logged-out web → Landing; /join bypass; native never)"
```

---

## Task 4: `LandingScreen` component (web-only)

**Files:**
- Create: `apps/poker-mobile/src/screens/LandingScreen.tsx`
- Test: `apps/poker-mobile/src/screens/__tests__/LandingScreen.test.tsx`

**Component contract:**
- Default export `LandingScreen()`. Renders `null` when `Platform.OS !== 'web'` (so it's inert if ever mounted on native).
- No required props (it's a navigator screen). Reads navigation via `useNavigation<NativeStackNavigationProp<RootStackParamList>>()`, premium via `usePremium()`, auth via `useAuth()`.
- Top-level wrapper: `<Screen>` then a single web `ScrollView` (vertical only — `horizontal` never enabled; content max-width centered for desktop using a token-based `maxWidth` on the inner container to prevent line-length sprawl and horizontal scroll).

**Section structure (in order — reserve space, no late injection):**
1. **Top bar / logo anchor** — `BrandHeader variant="brand"` (T Poker wordmark + logo home anchor) with a right-slot `Sign in` text button → `navigation.navigate('Login')`.
2. **Hero** — `LANDING_HERO.headline` (`typography.displaySerif`/`hero`), `LANDING_HERO.subhead` (`typography.body`, `colors.textMuted`), and two CTAs:
   - Primary `PrimaryButton variant="gradient"` label `LANDING_HERO.primaryCta` → `onStartFree()` (navigates guests into the free product: `navigation.navigate('LocalNewGame', { mode: 'cash' })`).
   - Secondary `PrimaryButton variant="outline"` label `LANDING_HERO.secondaryCta` → scrolls/links to pricing (web: set a ref on the pricing section and call `scrollTo`; acceptable fallback: `navigation.navigate` no-op + visual anchor). Keep it a real, focusable control.
3. **Club-tool value** (the differentiator) — section title via `components/SectionTitle` (pass pre-uppercased `FREE CLUB TOOL`); map `LANDING_CLUB_VALUE` into `Card variant="flat"` rows, each with an Ionicon in a `goldFaint` circle, title (`typography.h4`), body (`typography.bodySmall`/`textMuted`).
4. **Premium Study value** ("get better between sessions") — `SectionTitle` `BETWEEN SESSIONS`; lead line repeating `PREMIUM_STUDY_BENEFIT`; map `LANDING_STUDY_VALUE` cards (same row pattern).
5. **Pricing** — `SectionTitle` `PRICING`; render `landingPlans()` as two `Card`s side-by-side (stack vertically below a token breakpoint via flex-wrap). The yearly card uses `Card variant="hero"` (gold hairline) + a "Best value" `Chip` to signal `highlighted`. Each card shows `price` (`typography.amountLarge`), `cadence`, optional `subline`, then the benefit list from `landingBenefits()`:
   - Live benefit (`comingSoon === false`): checkmark Ionicon + benefit text.
   - Soon benefit (`comingSoon === true`): muted text + `<Chip label="Soon" tone="neutral" />` and **NO** purchase affordance on that row.
   - Each card has exactly one CTA `PrimaryButton` (`gradient` for yearly, `gold`/`outline` for monthly) labelled e.g. `Get Premium — $99.99/yr` → `onChoosePlan(plan.key)`. The CTA belongs to the CARD (the live offer), never to an individual Soon row.
6. **FAQ** — `SectionTitle` `FAQ`; map `LANDING_FAQ` into simple Q (`typography.h4`) / A (`typography.body`/`textMuted`) blocks (static, expanded — no accordion needed; keeps CLS at 0 and is SR-friendly). Each block `accessible` with a combined label.
7. **Footer** — `LANDING_DISCLAIMER` text (`18+ · not a gambling product`, `typography.caption`/`textMuted`) and `LANDING_LEGAL_LINKS` rendered as `PressableScale` links (`accessibilityRole="link"`) → `Linking.openURL(href)` (relative `/privacy.html` / `/terms.html` resolve on the web host; on web `Linking.openURL` opens same-origin).

**CTA behavior (`onChoosePlan(plan)`):**
```
const { isPremium, purchase } = usePremium();
const { user } = useAuth();
async function onChoosePlan(plan: 'monthly' | 'yearly') {
  const productId = plan === 'yearly' ? PRICING.yearly.productId : PRICING.monthly.productId;
  if (user) {
    await purchase(productId);          // Subsystem 3 — PremiumContext; refresh handled there/by EntitlementsContext
    return;
  }
  await savePendingCheckout(plan);      // resume after auth (AppNavigator null→user handler in Task 5)
  navigation.navigate('Register');      // sign-up modal in the guest tree
}
```
If `isPremium` is already true, render a "You're Premium" state for the pricing CTA area instead of buy buttons (mirror `PaywallScreen`'s premium branch — keep copy short).

**States:**
- Off-web → `null`.
- `usePremium().purchasing` true → the active card's `PrimaryButton` shows `loading` (built-in spinner) and is disabled.
- `isPremium` true → pricing CTAs replaced by the premium-active note.
- Reduced motion → no looping/entrance animation on the hero (guard any animation with `useReducedMotion()`; default to static — the page should be static-first for CLS anyway).

**Tokens/components reused:** `colors`, `typography`, `spacing`, `radii` (no raw hex); `Screen`, `Card`, `PrimaryButton`, `Chip`, `SectionTitle`, `BrandHeader`, `PressableScale`; Ionicons for all glyphs; `PRICING` for product IDs; `usePremium`, `useAuth`; `savePendingCheckout`; `landingContent` exports; `Linking` for legal links.

- [ ] **Step 1: Write the failing render smoke test**

Create `apps/poker-mobile/src/screens/__tests__/LandingScreen.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ── Mocks: keep the render hermetic (no real navigation / billing / auth) ──
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../../features/premium/state/PremiumContext', () => ({
  usePremium: () => ({ isPremium: false, purchasing: false, purchase: jest.fn() }),
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));
// BrandHeader pulls safe-area + navigation internals — stub to a label.
jest.mock('../../components/BrandHeader', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>T POKER</Text> };
});

import LandingScreen from '../LandingScreen';
import { PREMIUM_STUDY_BENEFIT } from '../../features/landing/landingContent';
import { PRICING } from '../../features/premium/config';

describe('LandingScreen (web)', () => {
  beforeAll(() => { (require('react-native').Platform as any).OS = 'web'; });

  it('renders the hero headline', () => {
    render(<LandingScreen />);
    expect(screen.getByText(/Run the night/i)).toBeTruthy();
  });

  it('renders both prices from PRICING', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText(new RegExp(PRICING.monthly.price.replace('$', '\\$'))).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(PRICING.yearly.price.replace('$', '\\$'))).length).toBeGreaterThan(0);
  });

  it('shows the live Premium Study benefit verbatim', () => {
    render(<LandingScreen />);
    expect(screen.getByText(PREMIUM_STUDY_BENEFIT)).toBeTruthy();
  });

  it('renders at least one Soon chip', () => {
    render(<LandingScreen />);
    expect(screen.getAllByText('Soon').length).toBeGreaterThan(0);
  });

  it('renders the legal footer (privacy, terms, 18+/not-gambling)', () => {
    render(<LandingScreen />);
    expect(screen.getByText('Privacy')).toBeTruthy();
    expect(screen.getByText('Terms')).toBeTruthy();
    expect(screen.getByText(/18\+/)).toBeTruthy();
    expect(screen.getByText(/not a gambling product/i)).toBeTruthy();
  });

  it('a11y: exposes accessible link roles for the legal links', () => {
    render(<LandingScreen />);
    // BrandHeader is stubbed; the only links are the footer legal links.
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(2);
  });

  it('honesty: pricing CTAs are present but no Soon row carries its own CTA', () => {
    render(<LandingScreen />);
    // Card-level CTA exists (live offer)…
    expect(screen.getAllByText(/Get Premium/i).length).toBeGreaterThan(0);
    // …and "Soon" only ever appears as a chip label, never inside a purchase button.
    const buyButtons = screen.getAllByText(/Get Premium/i);
    buyButtons.forEach(node => expect(node.props.children).not.toMatch(/Soon/i));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/screens/__tests__/LandingScreen.test.tsx`
Expected: FAIL — `Cannot find module '../LandingScreen'`.

- [ ] **Step 3: Write the implementation**

Create `apps/poker-mobile/src/screens/LandingScreen.tsx` per the **Component contract** and **Section structure** above. Build the real sections using the listed primitives/tokens. Skeleton (the executor fleshes the styled markup per `ui-ux-pro-max`, keeping the contract/states/tokens above — do not invent new tokens or hex):

```tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Card from '../components/Card';
import Chip from '../components/Chip';
import SectionTitle from '../components/SectionTitle';
import PrimaryButton from '../components/PrimaryButton';
import BrandHeader from '../components/BrandHeader';
import PressableScale from '../components/motion/PressableScale';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { radii } from '../theme/radii';
import { usePremium } from '../features/premium/state/PremiumContext';
import { useAuth } from '../context/AuthContext';
import { PRICING } from '../features/premium/config';
import { savePendingCheckout, type CheckoutPlan } from '../utils/pendingCheckout';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  LANDING_HERO, LANDING_CLUB_VALUE, LANDING_STUDY_VALUE, PREMIUM_STUDY_BENEFIT,
  landingPlans, landingBenefits, LANDING_FAQ, LANDING_LEGAL_LINKS, LANDING_DISCLAIMER,
} from '../features/landing/landingContent';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LandingScreen() {
  if (Platform.OS !== 'web') return null;
  const navigation = useNavigation<Nav>();
  const { isPremium, purchasing, purchase } = usePremium();
  const { user } = useAuth();

  async function onChoosePlan(plan: CheckoutPlan) {
    const productId = plan === 'yearly' ? PRICING.yearly.productId : PRICING.monthly.productId;
    if (user) { await purchase(productId); return; }
    await savePendingCheckout(plan);
    navigation.navigate('Register');
  }

  const plans = landingPlans();
  const benefits = landingBenefits();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsHorizontalScrollIndicator={false}>
        <View style={styles.maxWidth}>
          <BrandHeader
            variant="brand"
            right={
              <PressableScale onPress={() => navigation.navigate('Login')} accessibilityRole="button" accessibilityLabel="Sign in">
                <Text style={styles.signIn}>Sign in</Text>
              </PressableScale>
            }
          />

          {/* 1. Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{LANDING_HERO.headline}</Text>
            <Text style={styles.heroSub}>{LANDING_HERO.subhead}</Text>
            <View style={styles.heroCtas}>
              <PrimaryButton variant="gradient" label={LANDING_HERO.primaryCta}
                onPress={() => navigation.navigate('LocalNewGame', { mode: 'cash' })} />
              <PrimaryButton variant="outline" label={LANDING_HERO.secondaryCta}
                onPress={() => { /* scroll-to-pricing ref; focusable anchor */ }} />
            </View>
          </View>

          {/* 2. Free club tool */}
          <SectionTitle>FREE CLUB TOOL</SectionTitle>
          {LANDING_CLUB_VALUE.map(v => <ValueCard key={v.title} {...v} />)}

          {/* 3. Between sessions — Premium Study */}
          <SectionTitle>BETWEEN SESSIONS</SectionTitle>
          <Text style={styles.lead}>{PREMIUM_STUDY_BENEFIT}</Text>
          {LANDING_STUDY_VALUE.map(v => <ValueCard key={v.title} {...v} />)}

          {/* 4. Pricing */}
          <SectionTitle>PRICING</SectionTitle>
          <View style={styles.plans}>
            {plans.map(p => (
              <Card key={p.key} variant={p.highlighted ? 'hero' : 'flat'} style={styles.planCard}>
                {p.highlighted ? <Chip label="Best value" tone="gold" /> : null}
                <Text style={styles.price}>{p.price}</Text>
                <Text style={styles.cadence}>{p.cadence}</Text>
                {p.subline ? <Text style={styles.subline}>{p.subline}</Text> : null}
                <View style={styles.benefits}>
                  {benefits.map(b => (
                    <View key={b.title} style={styles.benefitRow}>
                      {b.comingSoon
                        ? <><Text style={styles.benefitSoon}>{b.title}</Text><Chip label="Soon" tone="neutral" /></>
                        : <><Ionicons name="checkmark-circle" size={16} color={colors.gold} /><Text style={styles.benefitLive}>{b.title}</Text></>}
                    </View>
                  ))}
                </View>
                {isPremium
                  ? <Text style={styles.premiumNote}>You're Premium ✦</Text>
                  : <PrimaryButton
                      variant={p.highlighted ? 'gradient' : 'outline'}
                      loading={purchasing}
                      label={`Get Premium — ${p.price}/${p.key === 'yearly' ? 'yr' : 'mo'}`}
                      onPress={() => onChoosePlan(p.key)} />}
              </Card>
            ))}
          </View>

          {/* 5. FAQ */}
          <SectionTitle>FAQ</SectionTitle>
          {LANDING_FAQ.map(f => (
            <View key={f.q} style={styles.faq} accessible accessibilityLabel={`${f.q}. ${f.a}`}>
              <Text style={styles.faqQ}>{f.q}</Text>
              <Text style={styles.faqA}>{f.a}</Text>
            </View>
          ))}

          {/* 6. Footer */}
          <View style={styles.footer}>
            <View style={styles.legalRow}>
              {LANDING_LEGAL_LINKS.map(l => (
                <PressableScale key={l.href} onPress={() => Linking.openURL(l.href)}
                  accessibilityRole="link" accessibilityLabel={l.label}>
                  <Text style={styles.legalLink}>{l.label}</Text>
                </PressableScale>
              ))}
            </View>
            <Text style={styles.disclaimer}>{LANDING_DISCLAIMER}</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ValueCard({ icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <Card variant="flat" style={styles.valueCard}>
      <View style={styles.valueIcon}><Ionicons name={icon} size={20} color={colors.gold} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.valueTitle}>{title}</Text>
        <Text style={styles.valueBody}>{body}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, paddingBottom: spacing.huge, alignItems: 'center' },
  maxWidth: { width: '100%', maxWidth: 920, gap: spacing.lg },
  signIn: { ...typography.label, color: colors.gold },
  hero: { gap: spacing.md, paddingVertical: spacing.xl },
  heroTitle: { ...typography.hero, color: colors.text },
  heroSub: { ...typography.bodyLarge, color: colors.textMuted, maxWidth: 640 },
  heroCtas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  lead: { ...typography.h4, color: colors.goldLight },
  valueCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  valueIcon: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.goldFaint, alignItems: 'center', justifyContent: 'center' },
  valueTitle: { ...typography.h4, color: colors.text },
  valueBody: { ...typography.bodySmall, color: colors.textMuted },
  plans: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  planCard: { flexGrow: 1, flexBasis: 320, gap: spacing.sm },
  price: { ...typography.amountLarge, color: colors.text },
  cadence: { ...typography.bodySmall, color: colors.textMuted },
  subline: { ...typography.bodySmall, color: colors.goldLight },
  benefits: { gap: spacing.sm, paddingVertical: spacing.sm },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitLive: { ...typography.body, color: colors.textHigh, flex: 1 },
  benefitSoon: { ...typography.body, color: colors.textMuted, flex: 1 },
  premiumNote: { ...typography.label, color: colors.gold, textAlign: 'center', paddingVertical: spacing.sm },
  faq: { gap: spacing.xs, paddingVertical: spacing.sm },
  faqQ: { ...typography.h4, color: colors.text },
  faqA: { ...typography.body, color: colors.textMuted },
  footer: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  legalRow: { flexDirection: 'row', gap: spacing.lg },
  legalLink: { ...typography.bodySmall, color: colors.textMuted, textDecorationLine: 'underline' },
  disclaimer: { ...typography.caption, color: colors.textDim },
});
```

> If `components/SectionTitle` or a `Chip` `tone="gold"` is not available with that exact API, check the component before use and adjust to the real prop (`SectionTitle` renders children verbatim per CLAUDE.md; `Chip` tones come from `components/chipVisual.ts` — use an existing tone, e.g. `gold` if defined else `neutral`/`solid`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/screens/__tests__/LandingScreen.test.tsx`
Expected: PASS — all 7 cases green. If `react-native`'s `Platform.OS` mutation doesn't stick, set it via `jest.mock('react-native/Libraries/Utilities/Platform', ...)` or `Object.defineProperty`; the test already forces `OS = 'web'` in `beforeAll`.

- [ ] **Step 5: Commit**

```bash
git add apps/poker-mobile/src/screens/LandingScreen.tsx apps/poker-mobile/src/screens/__tests__/LandingScreen.test.tsx
git commit -m "feat(landing): web-only LandingScreen (hero, club value, Premium Study, pricing w/ Soon chips, FAQ, legal footer)"
```

---

## Task 5: Wire routing in `AppNavigator` (web `/` → Landing; deep-link bypass; pending-checkout resume)

**Files:**
- Modify: `apps/poker-mobile/src/navigation/AppNavigator.tsx`

This task has no new unit test of its own (the decision logic is already covered by `landingRouting.test.ts` from Task 3 and the pending-checkout behavior by Task 1). It is verified by the gates (`tsc`, `expo export -p web`) and a manual web run. Keep edits minimal and additive.

- [ ] **Step 1: Add imports**

Near the other screen imports in `AppNavigator.tsx`:

```ts
import LandingScreen from '../screens/LandingScreen';
import { resolveWebLanding } from '../features/landing/landingRouting';
import { consumePendingCheckout } from '../utils/pendingCheckout';
```

- [ ] **Step 2: Register the `Landing` route type**

In `RootStackParamList` add:

```ts
  Landing: undefined;
```

- [ ] **Step 3: Add `Landing` to the `linking` config**

In the `linking` `config.screens` object, add a root mapping so the web URL `/` resolves to Landing (the deep-link `join/*` entries already win for those paths because they are more specific). Add:

```ts
      Landing: '',
```

(An empty path maps the site root `/` to `Landing`. `/join/group/:token` and `/join/session/:token` remain matched by their explicit patterns and therefore bypass Landing.)

- [ ] **Step 4: Render `Landing` first in the guest tree on web**

Inside the `user === null` branch of `Stack.Navigator`, render the Landing screen as the FIRST `<Stack.Screen>` ONLY when `resolveWebLanding` says so. Compute once near the top of the component:

```ts
  const showLanding = resolveWebLanding({
    platform: Platform.OS as 'web' | 'ios' | 'android',
    isAuthed: user !== null,
    // On web, the initial path; React Navigation linking handles subsequent nav.
    path: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.pathname : '/',
  });
```

Then, as the first child of the guest `<>` (before Onboarding), add:

```tsx
            {showLanding && (
              <Stack.Screen name="Landing" component={LandingScreen} options={{ headerShown: false }} />
            )}
```

Because it is the first registered screen when `showLanding` is true, React Navigation makes it the default route for `/`. Deep links still resolve to `JoinGroup`/`JoinSession` via `linking` (their explicit paths bypass it). When `showLanding` is false (native, or a deep-link path, or already authed), the tree behaves exactly as today. Also register `Landing` in the AUTHED tree is NOT needed (logged-in users never see Landing); if a stale `/` hits the authed tree, the existing first screen (`MainTabs`) serves the app, satisfying "logged-in → app".

- [ ] **Step 5: Resume a pending checkout after sign-up (null → user)**

Augment the existing `useEffect` that calls `consumePendingInvite()` on the null→user transition so it ALSO resumes a pending checkout. Add, right after the existing invite-resume block inside the same effect (or as a sibling effect with the same `wasGuest`/`user` guard):

```ts
    consumePendingCheckout().then(plan => {
      if (!plan) return;
      const go = () => {
        const nav = navigationRef?.current;
        if (nav?.isReady()) {
          // Land them on the paywall to complete the purchase now that they're authed.
          // (Paywall reads PRICING; the plan toggle defaults to yearly — pass the chosen plan as trigger context.)
          nav.navigate('Paywall', { trigger: `landing_${plan}` });
        } else {
          setTimeout(go, 150);
        }
      };
      setTimeout(go, 300);
    });
```

> Rationale: completing the actual Stripe `purchase()` requires Subsystem 3's billing seam. Routing the freshly-authed user to `Paywall` (already in both trees) is the honest, decoupled handoff — they finish checkout there. This keeps Subsystem 4 independently shippable: if Subsystem 3's live Stripe isn't wired yet, Paywall still renders honestly (mock provider / Soon states). If you prefer to auto-invoke `purchase()` here instead, do so only behind a check that `usePremium` is reachable from this scope — it is NOT (this is outside the provider's hook context at the navigator root), so prefer the Paywall handoff.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS — `Landing` route typed; `Platform` already imported in `AppNavigator.tsx`.

- [ ] **Step 7: Run the full unit suite**

Run: `npx jest`
Expected: PASS — all suites green (routing/gating covered by `landingRouting.test.ts`; pending-checkout by `pendingCheckout.test.ts`; render by `LandingScreen.test.tsx`).

- [ ] **Step 8: Commit**

```bash
git add apps/poker-mobile/src/navigation/AppNavigator.tsx
git commit -m "feat(landing): route web / to Landing for logged-out visitors; /join bypass; resume pending checkout post-auth"
```

---

## Task 6: Full gates + manual web verification

**Files:** none (verification only).

- [ ] **Step 1: Type check**

Run (from `apps/poker-mobile`): `npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 2: Unit tests**

Run: `npx jest`
Expected: PASS — including `pendingCheckout`, `landingContent`, `landingRouting`, `LandingScreen` suites; existing suites unchanged.

- [ ] **Step 3: Web export gate**

Run: `npx expo export -p web`
Expected: build completes with no errors and emits `dist/`. (LandingScreen must compile under react-native-web; confirm no native-only imports leak — it uses only `react-native`, `expo-linear-gradient` via `Card`/`Screen`, Ionicons, and `Linking`.)

- [ ] **Step 4: Manual web smoke (logged-out)**

Run: `npm run web`, open `http://localhost:8081/` in a logged-out browser session.
Verify: Landing renders (hero, club value, Premium Study, pricing with yearly highlighted + Soon chips on non-live benefits, FAQ, legal footer with Privacy/Terms + `18+ · not a gambling product`); no horizontal scroll at desktop and mobile widths; visible focus ring when tabbing to CTAs and legal links; OS "Reduce Motion" produces a static hero.

- [ ] **Step 5: Manual web smoke (deep link + authed bypass)**

- Open `http://localhost:8081/join/group/test-token` logged out → the Join flow (sign-in-to-join) renders, NOT Landing.
- Sign in, then open `/` → the app (Home/MainTabs) renders, NOT Landing.
- Logged out, tap a pricing CTA → routed to Register; complete sign-up → lands on Paywall (pending checkout resumed).

- [ ] **Step 6: Commit (only if any fix was needed)**

```bash
git add -A
git commit -m "chore(landing): web verification fixes (gates green: tsc, jest, expo export)"
```

> If all gates pass with no changes, skip this commit.

---

## Self-Review (run after writing — recorded for the executor)

**Spec coverage (§8 + §1–§4, §9, §11):**
- §8 web-only LandingScreen, two-sided hook-forward → Task 4 (sections 1–7). ✅
- §8 inline pricing, monthly/yearly, Soon chips, exact `premium_study` copy → Tasks 2 + 4. ✅
- §8 routing: web `/` → Landing logged-out; logged-in → app; `/join/*` bypass → Tasks 3 + 5. ✅
- §8 CTA: signed-in → `purchase()`; else sign-up → pending-checkout stash → resume → Tasks 1 + 4 + 5. ✅
- §8 `utils/pendingCheckout.ts` mirrors `pendingInvite.ts` → Task 1. ✅
- §9 TDD red→green per new logic; gates `tsc`/`jest`/`expo export -p web` → every task + Task 6. ✅
- §10/§4 honesty: exactly one non-Soon benefit (`premium_study`); no buy path on Soon rows; PACK-10 excluded → Task 2 tests + Task 4 honesty test. ✅
- §11 a11y/tokens/SVG/brand: semantic tokens only, Ionicons, DM Serif/Sora/Inter via typography, reduced-motion, ≥44×44 (PrimaryButton minHeight 52 / targets), no horizontal scroll, logo anchor, link roles → Task 4 contract + a11y test. ✅
- Cross-subsystem dependency on Subsystem 3 referenced, not duplicated; plan independently testable → noted throughout; Task 5 Paywall handoff keeps it decoupled. ✅

**Placeholder scan:** every code step contains real code; commands have expected output; no "TBD"/"add error handling"/"similar to". The two styling notes explicitly defer only the final visual polish to `ui-ux-pro-max` while pinning structure/states/tokens/tests (allowed by the brief). ✅

**Type consistency:** `CheckoutPlan` ('monthly'|'yearly') used in Tasks 1, 4, 5; `savePendingCheckout`/`consumePendingCheckout` names consistent; `resolveWebLanding`/`isDeepLinkPath` names consistent; `landingPlans`/`landingBenefits`/`PREMIUM_STUDY_BENEFIT` consistent across Tasks 2 + 4; `RootStackParamList.Landing` added once (Task 5) and used by the screen registration. ✅

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-25-landing-pricing.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
