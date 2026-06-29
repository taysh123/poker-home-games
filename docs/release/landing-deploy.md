# Marketing Landing — Deployment (`apps/landing`)

The marketing landing page is a **standalone Next.js 15 static-export site** at `apps/landing/`,
fully decoupled from the Expo app (`apps/poker-mobile`) and the .NET backend. It is deployed as its
**own Vercel project** — separate from the main app project — so it can ship independently and carry
its own marketing-grade animations without touching the product build.

> **Two different Vercel projects — don't confuse them.**
> - **App** (the live product): root `apps/poker-mobile`, domain `poker-home-games-three.vercel.app`.
>   Signup + Paddle billing live here. The landing's CTAs all link OUT to it.
> - **Landing** (this doc): root `apps/landing`, its own domain (TBD). Marketing only — no auth,
>   no API, no secrets.

---

## What gets deployed

A single static page (8 blocks: Hero · Social Proof · Benefits · How It Works · Pricing · FAQ ·
Final CTA · Footer) plus:

- `og.png` (1200×630 social share image), `icon.svg` (favicon)
- `sitemap.xml` + `robots.txt` (generated at build by `app/sitemap.ts` / `app/robots.ts`, both
  `force-static`)
- Lazy, **desktop-only** WebGL flourishes — a three.js hero chip and an OGL aurora behind the Final
  CTA — code-split into async chunks that mobile / reduced-motion users never download.

No `vercel.json` and **no SPA rewrites** are needed (it's a single page). The app project's
`vercel.json` SPA rewrite is for the *app*, not this site.

---

## Vercel project settings

Create a **new** Vercel project pointed at this repo, then set:

| Setting | Value |
|---|---|
| **Root Directory** | `apps/landing` &nbsp; *(critical — must be the subdir, like the app project)* |
| **Framework Preset** | Next.js |
| **Build Command** | `next build` (default) |
| **Output Directory** | leave default. The Next.js preset detects `output: 'export'` and serves `out/`. If static assets 404, set Output Directory explicitly to `out`. |
| **Install Command** | `npm install` (default) |
| **Node.js Version** | 20.x or newer (build uses only `next build`; the vitest toolchain is dev-only) |

`next.config.mjs` already pins `output: 'export'` + `images: { unoptimized: true }` (required for a
static export — there is no Next image-optimization server).

### Environment variables

| Variable | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | the landing's **own** production origin (e.g. `https://tpoker-landing.vercel.app` or a custom domain, **no trailing slash**) | Sets `metadataBase`, the canonical URL, OpenGraph `og:url`, the absolute `og:image` URL, and the `sitemap.xml` / `robots.txt` URLs. |

There are **no secrets**. CTAs hard-code the app URL (`lib/site.ts` → `SITE.appUrl`); there is no API
call from the landing.

**Until `NEXT_PUBLIC_SITE_URL` is set**, it falls back to the placeholder `https://tpoker-landing.vercel.app`
(`lib/site.ts`). Set it to the real domain and **redeploy** so canonical/OG/sitemap reflect the live
host — otherwise social previews and the sitemap point at the placeholder.

### Custom domain

Assign the domain in the Vercel project, then update `NEXT_PUBLIC_SITE_URL` to match and redeploy. If
you change the domain, regenerate `og.png` only if it visibly shows a URL you want updated (it
currently shows the **app** URL as the product destination, which is intentional).

---

## Local commands

```powershell
cd apps/landing
npm install
npm run dev      # local dev at http://localhost:3000
npm run build    # static export -> apps/landing/out/
```

Gates (must pass before deploy — all green as of this writing):

```powershell
cd apps/landing
npx tsc --noEmit     # types
npx vitest run       # honesty model (4 tests): exactly one live feature (premium_study), no buyHref on coming-soon, no store-badge hrefs
npm run build        # static export succeeds
npm run lint         # no warnings/errors
```

---

## Quality bar (verified)

Measured with the local Playwright harnesses in `%TEMP%\tpoker-verify\` (serve `out/`, headless
Chromium with SwiftShader for WebGL):

- **Performance** — `/` first-load JS ≈ **167 KB** (uncompressed; Vercel serves it brotli-compressed).
  three.js (~325 KB) and ogl/aurora bundles are **code-split** and load **only** on
  desktop + motion-allowed + in-view (via `next/dynamic` `ssr:false` + IntersectionObserver). LCP
  **≈ 0.6–0.8 s**, **CLS 0** at desktop, mobile, and reduced-motion.
- **Accessibility** — axe-core (WCAG 2 A/AA + best-practice) reports **0 violations** at desktop and
  mobile. One `<h1>`, semantic headings, visible focus, 44px targets, AA contrast.
- **Reduced-motion / mobile** — both WebGL flourishes are skipped (poster / static gradient
  fallback); mobile never downloads the 3D/aurora chunks.
- **SEO** — title/description/keywords, canonical, OpenGraph (+ 1200×630 image), Twitter card,
  `robots` index/follow, `sitemap.xml`, `robots.txt`.

---

## Honesty model (do not regress)

`lib/features.ts` + `__tests__/honesty.test.ts` enforce it (vitest gate):

- Exactly **one** live premium benefit — **Premium Study** — and it is the only feature with a
  `buyHref` (→ the app). Coming-soon features (AI Coach, Cloud Sync, Advanced Bankroll) render a
  "Coming soon" chip and **no purchase CTA**.
- Store badges are **disabled** "Coming soon" (no `href`).
- Pricing is **$8.99/mo · $79.99/yr** (matches the app paywall config and the Paddle products).
- Positioning is **never** "gambling" / "play for real money"; study content is **"Expert-Calibrated"**,
  never "GTO"/"solver-verified".

---

## Dependency advisories (conscious deferral)

After bumping `vitest` 2.1.9 → 4.1.9, `npm audit` (run in `apps/landing`) reports **0 high, 0 critical**.
The remaining **2 moderate** advisories are both `postcss <8.5.10`, pulled in transitively by `next`
(and tailwind/autoprefixer):

- **Advisory:** PostCSS XSS via unescaped `</style>` when stringifying **untrusted** CSS
  ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)).
- **Reachable here? No.** PostCSS runs only at **build time** on our own authored CSS (Tailwind +
  `globals.css`), never on untrusted input, and the output is static CSS served from a CDN. It is not
  in the shipped `out/` bundle.
- **Fix:** arrives when Next ships a release that bundles `postcss ≥ 8.5.10`; npm's only current
  "fix" is an absurd downgrade of `next`, so it is **consciously deferred**.

(The earlier high/critical advisories were in the `vite`/`vitest` dev-test chain — a Vite dev-server
`server.fs.deny` bypass and a Vitest UI arbitrary-file-read. Both required a listening dev/UI server
we never start, and neither shipped in `out/`. The `vitest` 4 bump cleared them.)
