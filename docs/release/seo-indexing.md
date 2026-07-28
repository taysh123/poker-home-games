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
| Sitemap DELETED, and `/sitemap.xml` + `/.well-known/*` excluded from the SPA rewrite | `apps/poker-mobile/vercel.json` | `/sitemap.xml` now 404s honestly. (An empty `<urlset>` is schema-invalid and Search Console reports it as an error, so "keep it but empty" was wrong; excluding it from the rewrite is what stops the shell answering with HTML.) |
| Build command moved INTO the repo | `apps/poker-mobile/vercel.json` `buildCommand` | `vercel.json` overrides the dashboard, so the head injector runs deterministically — no manual step, no chance of a mistyped command |
| Meta descriptions added | `public/privacy.html`, `public/terms.html` | Both lacked one; `pricing`/`refund` already had them |
| Head injector + `npm run build:web` | `apps/poker-mobile/scripts/injectWebHead.mjs` | Shared links unfurl with a real title/description/image instead of a bare "T Poker" |
| JSON-LD (Organization + WebSite only) | `apps/landing/app/layout.tsx` | Strengthens the landing as the entry point. **`SoftwareApplication` deliberately omitted**: its rich result REQUIRES `offers` (a price) or `aggregateRating` (stars), and we can honestly supply neither — including it would have had Search Console naming those two fields as the "fix", manufacturing pressure to fabricate them |
| Config pins | `poker-mobile/src/utils/__tests__/indexingPolicy.test.ts`, `landing/__tests__/structuredData.test.ts` | The policy cannot silently regress — including that the landing stays INDEXABLE (de-indexing both hosts would make the product invisible everywhere) |

### The trap worth remembering: `Disallow` would have made this worse
It is tempting to "block" the app host with `Disallow: /`. That is backwards for **removal**:
`Disallow` stops the crawler *fetching* the URL, so it never sees the `noindex`, and Google can
keep an already-indexed URL in results (as a bare link) indefinitely. **Allowing the crawl is what
lets the `noindex` be read and the URL dropped.** Only once Search Console reports coverage at
zero is a `Disallow` worth adding, purely to save crawl budget.

---

## ⚠️ Actions only the owner can take (not possible from the repo)

### ~~1. Vercel — app project build command~~ — NO LONGER NEEDED
An earlier draft of this doc told the owner to paste
`cd apps/poker-mobile && npm run build:web` into the dashboard. **That instruction was wrong
and would have failed every deploy:** the project's Root Directory *is* `apps/poker-mobile`, so
`cd apps/poker-mobile` from inside it exits 1 and `&&` short-circuits. Because Vercel keeps
serving the last good deployment, the symptom would not have been an outage — it would have been
silent: *every subsequent deploy failing*, including this entire slice.

Superseded: `buildCommand` now lives in `apps/poker-mobile/vercel.json`, which overrides the
dashboard setting. Nothing to do.

### 1. Vercel — make the old domain's redirect permanent *(recommended)*
`poker-home-games-three.vercel.app` → `app.tpoker.app` is currently a **307 (temporary)**,
configured at the dashboard level. Google treats a temporary redirect as only a *weak*
canonicalization signal, so consolidation is slow and not guaranteed and the old domain can
linger in the index; a **308 (permanent)** is the strong signal. Vercel's redirect UI exposes
this as a "Permanent" toggle.

*(For reference, the redirects that are already permanent and correct: `tpoker.app/{privacy,
terms,refund,pricing}.html` → `app.tpoker.app/...`, set to 308 in `apps/landing/vercel.json`.)*

### 2. Vercel — check the legacy landing alias
`tpoker-landing-xi.vercel.app` was the landing's early deploy URL. Confirm it redirects to
`tpoker.app` rather than serving a duplicate copy of the site. If it serves, only the canonical
tag prevents duplicate-host indexing.

### 3. Google Search Console — after this deploys
1. Add/verify both properties: `tpoker.app` and `app.tpoker.app`.
2. On **app.tpoker.app**: use **Removals → Temporary removal** for the host to clear results
   quickly, then let the `noindex` make it permanent. Watch *Pages → Not indexed → Excluded by
   'noindex'* climb; that is the success signal.
3. On **poker-home-games-three.vercel.app** (if verified): expect it to fall out once the
   redirect is permanent.
4. On **tpoker.app**: submit `https://tpoker.app/sitemap.xml` and confirm the homepage is
   indexed. Use **URL Inspection → Test live URL** to confirm the JSON-LD parses.
5. Re-check in ~2 weeks. De-indexing is not instant; the crawl has to happen first.

### 4. Nothing to do for the stores
`https://app.tpoker.app/privacy.html` remains a directly-served 200 — no redirect hop — which is
all App Store Connect and Play data-safety require. `noindex` affects search listing only, never
reachability.

**Accepted tradeoff, stated so it isn't rediscovered as a bug:** because the whole app host is
de-indexed, the privacy/terms pages are *reachable but not findable via web search*. That is
intended — the stores link them directly, and the landing links them too. If you ever want them
searchable, the fix is to exclude those four paths from the noindex header, not to weaken the
policy for the shell.

### Also worth knowing: `/.well-known/` had the same trap
The SPA rewrite used to answer `/.well-known/assetlinks.json` with HTML too. It is now excluded
(so it 404s honestly), but **the file still does not exist** — which means Android App Links for
`/join/*` cannot verify. That is a deep-linking gap, not an SEO one; it needs the release
keystore's SHA-256 fingerprint, which only you can supply. Tracked separately — this slice
deliberately does not fake it.
