# SEO & indexing — one public entry point

> **Decision (Q1.3, owner 2026-07-28):** `tpoker.app` (the marketing site) is the **single public
> search entry point**. `app.tpoker.app` is the **application host** and is de-indexed.

## Why the app host had to stop being indexable

`apps/poker-mobile/vercel.json` rewrites `/(.*)` → `/index.html`, so **every** URL on
`app.tpoker.app` returns HTTP 200 with the same client-rendered shell. The shell has no server
-rendered content. That produced an unbounded set of identical, contentless URLs — including one
per shared invite link (`/join/group/<token>`) — all eligible for indexing, all competing with
`tpoker.app` for the same brand queries, and none useful to a searcher.

## What shipped in the repo

| Change | File | Effect |
|---|---|---|
| `X-Robots-Tag: noindex` on every path | `apps/poker-mobile/vercel.json` | The whole app host drops out of the index, including invite URLs |
| robots.txt keeps `Allow: /`, drops the `Sitemap:` line | `apps/poker-mobile/public/robots.txt` | Crawling stays open **on purpose** (see the trap below); nothing is submitted |
| Sitemap emptied (file retained) | `apps/poker-mobile/public/sitemap.xml` | Submits no URLs. Kept rather than deleted because the SPA rewrite would otherwise serve HTML at `/sitemap.xml` with a 200 |
| Meta descriptions added | `public/privacy.html`, `public/terms.html` | Both lacked one; `pricing`/`refund` already had them |
| Head injector + `npm run build:web` | `apps/poker-mobile/scripts/injectWebHead.mjs` | Shared links unfurl with a real title/description/image instead of a bare "T Poker" |
| JSON-LD (Organization, WebSite, SoftwareApplication) | `apps/landing/app/layout.tsx` | Strengthens the landing as the entry point. **No `offers`/price, no `aggregateRating`** — nothing is purchasable and there are no reviews to cite |
| Config pins | `src/utils/__tests__/indexingPolicy.test.ts` | The policy can't silently regress |

### The trap worth remembering: `Disallow` would have made this worse
It is tempting to "block" the app host with `Disallow: /`. That is backwards for **removal**:
`Disallow` stops the crawler *fetching* the URL, so it never sees the `noindex`, and Google can
keep an already-indexed URL in results (as a bare link) indefinitely. **Allowing the crawl is what
lets the `noindex` be read and the URL dropped.** Only once Search Console reports coverage at
zero is a `Disallow` worth adding, purely to save crawl budget.

---

## ⚠️ Actions only the owner can take (not possible from the repo)

### 1. Vercel — app project build command *(required for the unfurl fix)*
The web build command lives in the **Vercel dashboard**, not the repo. Change it from:

```
cd apps/poker-mobile && npx expo export -p web
```
to:
```
cd apps/poker-mobile && npm run build:web
```

Everything else in this slice ships automatically; **only the head injection depends on this.**
Without it, the de-indexing still works and invite links keep unfurling bare.

### 2. Vercel — make the old domain's redirect permanent *(recommended)*
`poker-home-games-three.vercel.app` → `app.tpoker.app` is currently a **307 (temporary)**,
configured at the dashboard level. A 307 does **not** consolidate ranking signals, so the old
domain can stay indexed indefinitely. Change it to a **308 (permanent)** — Vercel's redirect UI
exposes this as a "Permanent" toggle.

*(For reference, the redirects that are already permanent and correct: `tpoker.app/{privacy,
terms,refund,pricing}.html` → `app.tpoker.app/...`, set to 308 in `apps/landing/vercel.json`.)*

### 3. Vercel — check the legacy landing alias
`tpoker-landing-xi.vercel.app` was the landing's early deploy URL. Confirm it redirects to
`tpoker.app` rather than serving a duplicate copy of the site. If it serves, only the canonical
tag prevents duplicate-host indexing.

### 4. Google Search Console — after this deploys
1. Add/verify both properties: `tpoker.app` and `app.tpoker.app`.
2. On **app.tpoker.app**: use **Removals → Temporary removal** for the host to clear results
   quickly, then let the `noindex` make it permanent. Watch *Pages → Not indexed → Excluded by
   'noindex'* climb; that is the success signal.
3. On **poker-home-games-three.vercel.app** (if verified): expect it to fall out once the
   redirect is permanent.
4. On **tpoker.app**: submit `https://tpoker.app/sitemap.xml` and confirm the homepage is
   indexed. Use **URL Inspection → Test live URL** to confirm the JSON-LD parses.
5. Re-check in ~2 weeks. De-indexing is not instant; the crawl has to happen first.

### 5. Nothing to do for the stores
`https://app.tpoker.app/privacy.html` remains a directly-served 200 — no redirect hop — which is
all App Store Connect and Play data-safety require. `noindex` affects search listing only, never
reachability.
