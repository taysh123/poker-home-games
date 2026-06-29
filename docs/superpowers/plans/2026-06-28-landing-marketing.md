# T Poker Marketing Landing Page — Implementation Plan

> Subagent-driven build. Standalone Next.js static-export site at `apps/landing/`, fully decoupled from the
> Expo app (Option C). English only. Built on `feature/launch-phase-1-2`; nothing merged.

**Goal:** A fast, SEO-friendly, visually impressive marketing site positioning the FREE home-game manager as
the hero and strategy learning as the bonus — never "gambling." Primary CTAs link OUT to the existing web app
(signup + Paddle live there). Honest: only Premium Study is a live premium benefit.

**Stack:** Next.js (App Router, `output: 'export'`) · TypeScript · Tailwind · Framer Motion · Aceternity/Magic UI
(vendored component source) · three.js + @react-three/fiber + drei (ONE lazy hero element) · lottie-react ·
lucide-react · vitest (honesty gate).

**Hard constraints (ui-ux-pro-max):** LCP fast (hero text + a pre-sized WebP; everything heavy lazy/below-fold);
CLS < 0.1 (transform/opacity only, reserved space via aspect-ratio); honor `prefers-reduced-motion`; lighter
mobile variant (parallax/tilt/3D reduced or off); AA contrast ≥ 4.5:1; one `<h1>`, semantic headings, visible
focus, 44px targets, SVG icons (no emoji-as-icons), alt text; full meta/OG for SEO.

---

## Design system

- **Colors (complement the app):** base `#0F1923`; surfaces `#1A2535`/`#1E2D3D`; border `#243447`; gold
  `#C9A84C` + light `#E8C97A` + dark `#A8872E` (CTAs/key numerals ONLY — restrained, never casino-flashy);
  text `#FFFFFF`/`#E8EDF2`/muted `#7A8A99`; success `#27AE60`; subtle felt-green→navy gradient-mesh background.
- **Type:** DM Serif Display (headlines/hero) + Inter (body) via `next/font` (self-hosted, `display:swap`);
  tabular numerals for prices; body ≥16px, line-height 1.5, a clear modular scale (e.g. 14/16/18/20/28/40/64).
- **Primitives (`components/ui/`):** `Container` (max-w ~1120, centered), `Section` (vertical rhythm),
  `Button` (gold primary / outline secondary, 44px, focus ring), `Card` (glass + gold hairline), `AnimatedText`
  (Framer word/line reveal, reduced-motion-safe), `Reveal` (whileInView fade/slide, `once`), `TiltCard`
  (Aceternity mouse-follow perspective), `BorderBeam` (Magic UI shimmer), `StoreBadges` (disabled).

## Honesty model (single source + CI gate)
- `lib/features.ts`: `PREMIUM_FEATURES = [{ key:'premium_study', title:'Premium Study', live:true,
  buyHref: SITE.appUrl }, { key:'ai_coach', live:false }, { key:'cloud_sync', live:false },
  { key:'advanced_bankroll', live:false }]` (coming-soon entries have NO `buyHref`).
- Pricing renders a buy CTA ONLY when `feature.live && feature.buyHref`. Coming-soon → muted "Coming soon"
  chip, no CTA.
- `__tests__/honesty.test.ts` (vitest): exactly ONE `live` feature and it's `premium_study`; every non-live has
  no `buyHref`; `StoreBadges` config exposes no `href`. Mirrors the app's `honesty.test.ts`.

## Positioning (strict, throughout)
"Home-game management + strategy learning." NEVER "gambling"/"play for real money." Content is
"Expert-Calibrated," never "GTO"/"solver-verified." Free manager = hero; learning = bonus.

## CTAs / links
- `SITE.appUrl = https://poker-home-games-three.vercel.app` (Start Free / Premium CTAs link here).
- Store badges: disabled "Coming soon," `aria-disabled`, no `href`.
- Footer: privacy/terms → `${SITE.appUrl}/privacy.html` + `/terms.html` (resolve on the app domain);
  brand "T Poker," copyright "True Story Labs," contact `truestorylabs@gmail.com`.

## 8 blocks (copy = starting point; refine wording, keep meaning + honesty)
1. **Hero** — H1 "Run your home poker game — no mess, no arguments." Sub: "Track cash games and tournaments,
   settle debts automatically, and see your stats — all free. Want to improve? There's a personal coach too."
   Primary "Start Free" → app. Secondary: two disabled store badges. Visual: app mockup (live cash table /
   settlements) in a tilt card; the ONE three.js poker chip lazy beside it (poster fallback on mobile/reduced-motion).
2. **Social Proof** — honest trust line (transparent, automatic tracking) + a tasteful fill-later slot. NO invented
   numbers/testimonials.
3. **Benefits (3 outcomes)** — "No more arguing over who owes what" (auto debt settlement); "All your games in
   one place" (history, stats, who wins most); "Get better between sessions" (learning + AI coaching — Premium).
4. **How It Works (3 steps)** — Create a game (cash/tournament) → Add players + track buy-ins in real time →
   Automatic debt settlement, everything saved.
5. **Pricing** — Free: all management tools forever + a taste of learning. Premium ($8.99/mo or $79.99/yr): full
   lesson library (Premium Study). Coming soon (no CTA): AI Coach, Cloud Sync, Advanced Bankroll Analytics.
   Premium CTA → app.
6. **FAQ** — "Is this real-money gambling?" → No, a management/scorekeeping tool for home games; you don't play
   for real money in it. "Is the free version really free?" → Yes, all management tools free forever, no limits.
   "What does Expert-Calibrated mean?" → Content based on sound strategy and proven principles.
7. **Final CTA** — "Ready to end the chaos? Start free →" → app.
8. **Footer** — links (privacy/terms on app domain), brand, copyright True Story Labs, contact.

---

## Slices (commit + gates after each; gates = `tsc --noEmit` · `vitest` · `next build` · `next lint`)

- **Slice 1 — scaffold + design system + Hero (REVIEW GATE):** Next project, Tailwind + tokens + next/font,
  `lib/{site,features,content}.ts`, UI primitives, `honesty.test.ts`, layout (SEO shell + gradient bg), and the
  **Hero block** (static mockup + chip poster placeholder — no three.js yet) + footer shell so the page renders.
  → screenshot desktop + mobile; PAUSE for founder review of the direction.
- **Slice 2 — the remaining 7 blocks** (Social Proof, Benefits, How It Works, Pricing, FAQ, Final CTA, Footer)
  with their scroll/CSS-3D animations, reduced-motion-safe.
- **Slice 3 — three.js hero chip + perf pass:** lazy (`next/dynamic ssr:false`) + IntersectionObserver + desktop-
  only + reduced-motion → WebP poster on mobile/reduced-motion. Verify LCP/CLS, lazy-load weight.
- **Slice 4 — SEO + a11y/perf audit + deploy doc:** metadata/OG/sitemap/robots, axe/contrast pass, Lighthouse-
  style check; `docs/release/landing-deploy.md` (separate Vercel project: Root Dir `apps/landing`, Next, `out/`).

Isolation: own lockfile; the Expo (`apps/poker-mobile`) + `dotnet`/`jest` gates are untouched.
