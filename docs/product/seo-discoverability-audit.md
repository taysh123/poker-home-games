# SEO / Discoverability Audit (Deliverable H)

> **Status: audit + safe static wins shipped.** Honest about the ceiling: the web app is an Expo
> **client-rendered SPA** (no SSR/SSG), so deep SEO is limited until a rendering strategy is added. No
> fabricated SEO claims.

## Current state
- **Web = Expo web export** (react-native-web SPA). One HTML shell (`index.html`) + JS bundle; all content
  renders client-side. Vercel serves it with an SPA rewrite (`/(.*) → /index.html`).
- **Crawlability:** Googlebot executes JS so the shell can index, but per-route content/meta is weak (no
  server-rendered `<title>`/description/OG per page; social unfurls show the generic shell).
- **Existing public pages:** `/privacy.html`, `/terms.html` (real static HTML — index fine).

## Shipped now (safe, additive)
- `public/robots.txt` — allow-all + sitemap pointer.
- `public/sitemap.xml` — the real public pages (`/`, `/privacy.html`, `/terms.html`). Solver/spot pages are
  intentionally **omitted** until they're real indexable pages (no fabricated URLs).

## Recommended next (safe, no SSR)
- **Static head meta + Open Graph / Twitter cards** for the shell via the Expo web HTML template (title,
  description, `og:*`, `twitter:card`, a social image). One-time template change; improves the unfurl + the
  single indexable shell. (Not done blindly here — it touches the web build template; recommended + scoped.)
- **A `/solver` marketing landing** (static) describing the workspace — a real indexable page that deep-links
  into the app — once the `solver` flag is ready to surface.

## Needs SSR/SSG (documented ceiling — out of scope)
- **Per-spot / per-range indexable pages** (e.g. `/solver/:packId/:rangeId`) with unique server-rendered meta —
  the high-SEO win for a solver flagship — require SSG/SSR. Options (future, each a real decision):
  prerender selected routes, adopt Expo Router's static rendering, or a thin SSR/edge layer. All are larger
  initiatives; not started, not faked.
- **Dynamic OG images** per spot — same dependency.

## Verdict
Robots + sitemap + the meta/OG recommendation are the honest safe wins on an SPA. True solver-page SEO is a
documented future phase gated on a rendering strategy + the public-spot pages (see
`public-spot-library-architecture.md` + `seo-content-platform-architecture.md`).
