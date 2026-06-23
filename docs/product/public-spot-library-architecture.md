# Public Spot Library Architecture (Deliverable I)

> **Design-only; NOT built/launched.** Behind a future `publicSpots` flag (OFF everywhere today). Strictly
> separates PRIVATE saved spots (already built, on-device) from PUBLIC/shared spots (needs backend + moderation
> + privacy + abuse controls). Additive + vendor-neutral; consistent with the canonical pack.

## Private vs public (hard separation)
- **Private** (today): `data/savedSpotsStore.ts` — on-device bookmarks, never shared, no network.
- **Public** (future): an explicitly-published, server-stored, moderated artifact. Publishing is an opt-in
  action that COPIES a private spot into the public model — private spots are never auto-shared.

## Public spot model (proposed, additive)
```
PublicSpot {
  id; packId; rangeId; hand?; nodeId?;        // references the canonical pack
  title; description?;
  metadata: { board?, position, stackBb, scenario, tags[] };
  versioning: { version; supersedesId? };      // immutable versions; edits create a new version
  verification: { tier; verifiedBy?; solverEngine?; solverVersion? };  // inherits pack provenance
  difficulty: 'intro' | 'core' | 'advanced';
  popularity: { views; saves; rating? };       // server-aggregated, not user-trusted
  authoring: { authorId; status: 'private' | 'submitted' | 'verified' | 'public'; submittedAt?; reviewedBy? };
}
```

## Authoring model (lifecycle)
`private → submitted → verified → public` (+ `rejected`). Submission enters a moderation queue; only
`verified` spots become `public`. Verification ties to the pack's provenance (`verifiedBy`/`solverEngine`) — a
spot can't claim solver-tier unless its source pack is solver-tier. Honest tier labels carry through.

## Trust / abuse (gating, not built)
Server-authoritative popularity/ratings (never client-trusted), rate-limited submissions, moderation, profanity
/ spam controls, report flow, and per-author limits. SEO: public spots become real indexable pages (needs the
SSR/SSG strategy — see `seo-discoverability-audit.md`).

## Solver-pack ecosystem (sketch)
Pack distribution (bundled vs server-delivered), premium-pack entitlement gating (reuse the entitlement seam),
version upgrades, and signed provenance build on the canonical contract additively — all future + flag-gated.
