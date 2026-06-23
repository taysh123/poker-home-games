# Future SEO Content Platform (Deliverable O)

> **Design-only; additive, flag-gated.** Content types modeled on the existing content-pack seams
> (`docs/content-architecture/`). Honest about the SPA/SSR ceiling (see `seo-discoverability-audit.md`).

## Content types (additive ContentPack docs)
- **Articles** — long-form strategy posts (markdown body, like `LessonDoc`).
- **Strategy guides** — structured multi-section guides (a `LearningPathDoc` over articles + ranges + quizzes).
- **Glossary** — term → definition entries (small docs; cross-linkable from articles + the coach).
- **Learning hub** — a curated index surface composing the above + solver packs + learning paths.

All reuse the existing content pipeline (ContentStore, content packs, the import/validation seams) — new doc
**kinds**, not a new system. Entitlement gating reuses the premium seam (free vs premium content).

## SEO dependency (the real win + the ceiling)
The commercial value is **indexable** content (articles/guides/glossary) + public solver pages driving organic
acquisition. That requires SSR/SSG (the Expo-web SPA can't server-render per-page meta) — the documented
future rendering strategy. Until then: static pages (like privacy/terms), the shipped sitemap/robots, and
shell-level meta are the safe wins; dynamic per-article pages are gated on the rendering decision.

## Authoring + trust
Content authored via the workbook/export pipeline (the established content seam), versioned + verification-tiered
like packs. No fabricated content; illustrative vs solver-grounded clearly labelled.

## Gating
Behind `content` (+ a future `contentSeo` flag) — OFF in prod. Design-only this round; no articles shipped.
