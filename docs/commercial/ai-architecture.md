# AI Coach Architecture

> **Status: Anthropic adapter BUILT, INACTIVE (mock by default).** The vendor of record is **Anthropic**. The
> real `AnthropicCoachAiProvider` is implemented and selected by `CoachAiSettings:Provider=anthropic`, but the
> DEFAULT is the deterministic mock (no key ⇒ fail closed), and the client active provider is still
> `COACH_CONFIG.provider='mock'`. The `coach` flag is OFF in production. **Nothing here fabricates real AI
> availability** — the in-app coach is a labeled demo, and the Anthropic adapter throws (refunding the credit)
> until the server key + budget exist. The remaining blocker is the Anthropic API key, not code.

## Principles
- **The vendor key lives ONLY on the server.** `ICoachAiProvider`'s comment makes this explicit; the client
  never holds an AI key and never calls a vendor directly.
- **No anonymous AI.** `POST /api/coach/analyze` is `[Authorize]`; `serverCoachProvider` returns
  `requires_account` without a token.
- **Honest demo.** The AI coach paywall benefit is `comingSoon` (`premium/config.ts`); the coach output carries
  an educational, non-solver disclaimer. We never present the mock as a live model.
- **Vendor-neutral.** Swapping OpenAI / Anthropic / Gemini / self-hosted = implement one interface + flip
  config; callers are untouched.

## What exists (verified in-tree)

### Client (`apps/poker-mobile/src/features/coach/`)
| Piece | File | State |
|-------|------|-------|
| Vendor-agnostic seam | `types.ts` → `ICoachProvider` | stable |
| Active provider | `config.ts` → `COACH_CONFIG.provider = 'mock'` | **mock (demo)** |
| Provider registry | `providers/index.ts` → `getCoachProvider(id)` | `server`→`serverCoachProvider`; `mock`→mock; `openai/anthropic/gemini/self` are TODO → fall back to mock |
| Server provider | `providers/serverCoachProvider.ts` | routes to `POST /api/coach/analyze`, maps `ServerCoachError`; **not the active provider** |
| Enforcement intent | `config.ts` → `enforceLimits: true`, `requireAccount: true` | fail-closed |

To go live the client flips `COACH_CONFIG.provider` from `'mock'` to `'server'`.

### Server (`src/PokerApp.Application/Features/Coach/`, `.../Infrastructure/Services/`)
| Piece | File | State |
|-------|------|-------|
| AI seam | `Common/Interfaces/ICoachAiProvider.cs` | key server-side only |
| Active provider | `Services/MockCoachAiProvider.cs` (`id = "mock-server"`) | **mock (default)** |
| Anthropic adapter | `Services/AnthropicCoachAiProvider.cs` (`id = "anthropic"`) | **BUILT** — real Messages API over HTTP; educational system prompt; fail-closed (no key / non-2xx / malformed → throws → credit refunded); never fabricates |
| Generic vendor stub | `Services/VendorCoachAiProvider.cs` (`id = "vendor-unconfigured"`) | stub for any OTHER future vendor — faulted task, never fabricates |
| Config switch | `Services/CoachAiProviderFactory.cs` + `DependencyInjection.cs` | `Provider = "mock"` (default) \| `"anthropic"` \| `"vendor"`; key via `CoachAiSettings:ApiKey`, model via `:Model` (default `claude-sonnet-4-6`), base via `:ApiBase` |
| Proxy + enforcement | `Features/Coach/Commands/AnalyzeHandCommand.cs` → `POST /api/coach/analyze` | `[Authorize]`; reserve credit → call → refund on throw |

The DI switch (via `CoachAiProviderFactory`) mirrors the billing provider switch: default `mock`;
`Provider="anthropic"` selects the BUILT `AnthropicCoachAiProvider`. To go live the server sets
`CoachAiSettings:Provider="anthropic"` + `CoachAiSettings:ApiKey=<secret>` (+ optional `:Model`) — no code
change needed. `Provider="vendor"` remains a stub for a hypothetical different vendor.

## Demo ↔ live boundary (precise)
Today: client `mock` → labeled demo; server default `mock` → deterministic educational output. Even if the
client used `server`, it would reach the **server mock** — so the entire path is honest demo. Going live
requires **all** of: set `CoachAiSettings:Provider="anthropic"` + `ApiKey` (the adapter is already built);
flip client `COACH_CONFIG.provider="server"`; then (separately) flip the `coach` + `paywall` flags. Any single
step alone does not silently enable real AI.

## Guardrails (already built; honest degraded mode)
- **Credits — atomic, idempotent, refund-on-failure.** `AnalyzeHandCommandHandler` reserves a credit via
  `ICreditLedger.TryConsumeAsync` (keyed by `IdempotencyKey`) BEFORE calling the model; on **any** provider
  throw it calls `RefundAsync` — so an unavailable/erroring vendor never burns a credit.
- **Quota + tier.** `IEntitlementService` + `IAiCreditPolicyProvider` (`AiCreditSettings`: free = 1 lifetime,
  premium = 30/month). Out-of-credits → `QuotaExceededException` (402-style upsell), not a free analysis.
- **Rate limit.** Per-policy `MinIntervalSeconds` in the ledger, plus the `coach-analyze` fixed-window limiter
  (12/min) in `Program.cs`.
- **Fraud.** `IFraudEvaluator` records device + scores each request; blocks only when
  `FraudSettings.EnforceBlocking = true` (advisory today — enable after real traffic to tune thresholds).
- **Cost observability.** `IAuditLog` records `CreditSpend`, `AiUsage`, and an `AiCost` hook per analysis — the
  seam for per-provider spend accounting when a paid vendor is wired.
- **Fail-closed.** Invalid/again-anonymous/over-quota/blocked all deny; nothing degrades to "free real AI".

## Failure fallback
A provider exception (network, vendor 5xx, "not configured" from the stub) propagates to the handler's
`catch`, which **refunds the credit** and rethrows; the client maps it to a `CoachError`. The user sees an
error and keeps their credit — never a fabricated result.

## Replacing / adding a vendor
1. Implement `ICoachAiProvider` in a new `…CoachAiProvider.cs` (read key/model from `CoachAiSettings`; call the
   vendor; map to `CoachAnalysisResult`; keep the educational, non-solver `Disclaimer`).
2. Select it in `DependencyInjection.cs` (extend the `Provider` switch, e.g. `"openai"`/`"anthropic"`).
3. No caller, controller, client, or DTO changes — the seam is the contract.

## Exact human TODOs to go live
1. Create an **Anthropic** account; obtain an API key + set a **budget/spend cap**. (Vendor = decided; adapter built + tested.)
2. Set `CoachAiSettings__Provider=anthropic`, `CoachAiSettings__ApiKey=<secret>` (+ optional `__Model`) as server
   env (Railway). Never on the client.
3. Decide a per-analysis cost ceiling; wire the `AiCost` audit hook to real accounting/alerts.
4. After real traffic, set `FraudSettings:EnforceBlocking=true` with tuned thresholds.
5. Flip client `COACH_CONFIG.provider="server"`; then flip the `coach` (and `paywall`, if charging) flags.

## What is intentionally NOT done (and why)
- **No Anthropic key, no budget.** Owner-gated. The adapter is built but inert until `CoachAiSettings:ApiKey`
  is set; it throws (refunding the credit) until then.
- **No fabricated AI.** Mock output is clearly educational/demo; the Anthropic adapter never returns a result it
  didn't get from the model (non-2xx / malformed → throw).
- **Flags stay OFF.** `coach` (and `paywall`) remain OFF until the key + budget + (for charging) billing + legal
  are in place.
