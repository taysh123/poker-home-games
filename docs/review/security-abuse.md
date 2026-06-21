# Security & Abuse Review

First-class review track (Phase D2). Read-only audit. **No backend code was changed in this task** — the
hardening items below touch production auth/CORS and belong in a **dedicated, staged backend-security PR**
(implementing them inline on the UI/commercial branch risks prod auth; "do not break production").

## Overall posture: LOW current risk, well-hardened
Auth (JWT + rotating hashed refresh + family revocation), server-authoritative fail-closed entitlements,
consistent IDOR guards (membership/creator checks), no anonymous AI, atomic idempotent credit ledger, honest
`comingSoon` paywall + demo banners. Launch-ready **with the 3 P0 quick-wins below**. Risk jumps to HIGH the
moment real billing/AI ship **unless** the billing/content items are addressed concurrently.

## P0 — fix before any public launch (small, in a backend-security PR)
1. **JWT secret padding → fail-closed.** `Program.cs` pads a short signing key to 32 bytes (silent). Replace
   with a startup throw when `JwtSettings.SecretKey` < 32 chars. (Prod requires ≥64 per the deployment
   checklist, so a correctly-configured prod is unaffected — this just removes a silent-misconfig footgun.)
2. **CORS fallback → fail-closed.** Prod falls back to a hardcoded Vercel domain + uses prefix matching. If
   `AllowedOrigins` is empty, reject rather than fall back; pin exact origins (no `StartsWith`).
3. **Rate limiting is in-memory (per-instance).** Fine on one instance; becomes bypassable across instances.
   Move to a Redis-backed limiter before multi-instance (ties to the scalability work).

Other small hardening: add `UseHttpsRedirection()` in prod; raise BCrypt work factor 12→13–14; add a
`Subscriptions(UserId, CurrentPeriodEnd)` index; cooldown on repeated refresh-replay; device-token attestation
(any authed user can currently register a token — validate provenance); disable Swagger in prod.

## P1 — becomes critical when real billing/AI are wired (architecture already supports the fix)
- **Premium entitlement client cache** is display-only + server is authoritative (good). When billing is live,
  the server MUST re-validate entitlement on every premium spend (it already does for `/api/coach/analyze`).
  Never trust a client-sent tier/price.
- **Credit consume/refund** is atomic + idempotent; add HTTP-layer request-dedup when a real vendor is wired to
  close the retry timing window.
- **Subscription webhooks** use `LatestEventAtUtc` ordering — keep that when the real verifier lands.

## The key pre-monetization decision: bundled content is extractable
All content artifacts (coach grounding, quizzes, packs) **ship in the app bundle** → trivially extractable.
Gating is **UX, not DRM**. This is honest today (premium features are `comingSoon`, content is positioned as
educational). **Before charging for premium content**, decide: (A) server-gate/deliver premium packs only to
entitled users (`GET /api/content/packs?tier=`), or (B) keep bundled + treat as "educational for all" (market,
don't DRM). Shipping a paid tier whose content is bundled-for-everyone would undermine the paywall.

## Trust boundaries (what the server must never trust from the client)
Receipts (verify server-side — mock today), entitlement/tier/price, device tokens (attest), any `userId` in a
body (use the claim). All currently respected except device-token provenance.

## Secrets / PII
No secrets committed (OAuth client IDs are public). Account deletion exists + anonymizes sessions (GDPR-friendly);
add a deletion audit-log entry for compliance. No analytics/tracking SDK; passwords BCrypt, refresh hashed.

## Verdict
Ship-ready after the 3 P0 quick-wins (one focused backend PR). Treat the bundled-content decision + real-billing
re-validation + fraud-enforcement (`FraudSettings:EnforceBlocking=false` today, advisory) as **must-do
concurrently with monetization**, not after.
