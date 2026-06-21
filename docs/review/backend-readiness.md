# Backend & Infrastructure Readiness Audit

Read-only audit of the **actual** T Poker backend. First-class review track (Phase D2).

## Stack — and the Supabase question (answered)
**There is NO Supabase in this codebase** (`grep -ri supabase` → 0 matches). The real stack is:
- **API:** .NET 8, Clean Architecture + CQRS (MediatR), FluentValidation, on **Railway** (Docker).
- **DB:** **PostgreSQL** via EF Core (Npgsql) on Railway.
- **Web:** Expo web export on **Vercel**; **Mobile:** Expo SDK 54 via EAS.

If Supabase is a desired future direction, that is a **migration decision** (Postgres → Supabase Postgres + GoTrue auth + RLS + storage), not a documentation gap — it would replace the custom .NET auth/entitlement layer. **Not recommended without a concrete driver**: the current backend already provides auth, server-authoritative entitlements, an atomic credit ledger, and webhooks that a Supabase move would have to re-implement. Documented here so the ask is addressed honestly rather than assumed.

## Architecture — solid
- Layers `Domain ← Application ← Infrastructure`, `API` depends inward (`src/PokerApp.*`). MediatR/FluentValidation auto-registered by assembly scan. Thin controllers (11) → command/query → handler.
- Middleware order correct (CORS → exception → compression → rate-limiter → auth → authz → controllers); migrations run deferred at `ApplicationStarted` so `/health` answers within Railway's window.
- Exception→HTTP mapping centralized (`ExceptionHandlingMiddleware`).

## Database — schema-ready
- ~25 EF migrations; key indexes present (Users email/username/Google/Apple, Sessions.CreatorId, GroupMembers composite, CreditBalances `(UserId,PeriodKey)`, CreditLedgerEntries idempotency-key, Subscriptions `(Store,OriginalTransactionId)`).
- Monetization core landed (B2/B3/B5): `Subscription`, `CreditBalance`, `CreditLedgerEntry` (append-only), `DeviceBinding`, `StoreWebhookEvent` (idempotent).
- **Gap:** Npgsql connection pooling is default (not tuned) — set an explicit `MaxPoolSize` for Railway's connection ceiling before ~1k DAU.

## Auth & authorization
- JWT 15-min access + 30-day refresh (**hashed SHA-256** at rest), refresh-token rotation + family revocation on replay; Google + Apple sign-in with audience validation; email-registration hardening (B1).
- **No Postgres RLS** (that's a Supabase concept) — row access is enforced **app-level** in handlers: `[Authorize]` + `userId` from claims + group-membership/creator guards (fail-closed, consistent). Trade-off vs RLS: a leaked token + direct DB access would bypass handler guards, and a missing guard is a code bug rather than a DB-enforced policy. Acceptable for launch; RLS is a defense-in-depth nice-to-have (see security doc).

## Entitlement sync — server-authoritative
`EntitlementService` reads the newest valid `Subscription` (fail-closed → free); `CreditLedger.TryConsumeAsync` is a Serializable, idempotent, refund-on-failure ledger. Client polls `/api/auth/stats` (+ coach credits) on focus; the client cache is display-only, never authority. Store webhooks update subscriptions with out-of-order protection (`LatestEventAtUtc`). **Real receipt verification is mock today** (`BillingSettings:Provider=mock`) — external dependency.

## Content distribution
Today: content ships **bundled** in the app (`assets/content/0.8.1/*`, ingested by ContentStore; offline-capable, version-drift-guarded). Future: a `GET /api/content/packs` server-delivery path would enable delta updates without an app release (not yet built). See the security doc for the bundled-content extractability note (matters once premium content is real).

## Scalability gaps (ranked)
1. **Single instance + no distributed state:** in-memory rate limiter + no cache → won't scale horizontally as-is. Before ~1k DAU: tune DB pool; add Redis for rate-limit + hot reads (stats/leaderboards); move achievement/notification side-effects off the request path (they run inline today, wrapped in try/catch).
2. **No caching layer:** stats/leaderboards recompute per request.
3. **Observability:** structured logging present; no distributed tracing (add OpenTelemetry before multi-instance).
4. **Read replicas / multi-zone:** needed at 10k+ DAU.

## Readiness verdict
**Production-ready for launch at ~100–500 DAU** on a single Railway instance. The pooling/cache/rate-limit/background-job gaps are the work before ~1k DAU; multi-instance + replicas + APM before ~10k. Monetization plumbing is solid; going live is gated on the external integrations (real billing verifier, AI vendor) — see `docs/commercial/integration-boundaries.md`.
