# AI Coach Architecture

> **Status: mock / demo end-to-end, INACTIVE.** Both the client active provider (`COACH_CONFIG.provider =
> 'mock'`) and the server active provider (`CoachAiSettings.Provider = 'mock'` → `MockCoachAiProvider`) are
> deterministic mocks today. The `coach` feature flag is OFF in production. The vendor seams exist on both
> sides so going live is a contained swap. **Nothing here fabricates real AI availability** — the in-app coach
> is a labeled demo and the vendor adapter is a stub that throws until wired.

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
| Vendor adapter | `Services/VendorCoachAiProvider.cs` (`id = "vendor-unconfigured"`) | **stub — faulted task; throws "not configured"/"stub", never fabricates** |
| Config switch | `Services/CoachAiSettings.cs` + `DependencyInjection.cs` | `Provider = "mock"` (default) \| `"vendor"`; key via `CoachAiSettings:ApiKey` (env `CoachAiSettings__ApiKey`) |
| Proxy + enforcement | `Features/Coach/Commands/AnalyzeHandCommand.cs` → `POST /api/coach/analyze` | `[Authorize]`; reserve credit → call → refund on throw |

The DI switch mirrors the billing provider switch: default `mock`; `Provider="vendor"` selects the stub (which
throws until a real adapter is wired). To go live the server sets `CoachAiSettings:Provider="vendor"`,
`CoachAiSettings:ApiKey=<secret>`, and implements the vendor call in `VendorCoachAiProvider.AnalyzeAsync`.

## Demo ↔ live boundary (precise)
Today: client `mock` → labeled demo; server default `mock` → deterministic educational output. Even if the
client used `server`, it would reach the **server mock** — so the entire path is honest demo. Going live
requires **all** of: implement the vendor adapter; set `CoachAiSettings:Provider="vendor"` + `ApiKey`;
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
1. Choose a vendor; create the account; obtain an API key + set a **budget/spend cap** with the vendor.
2. Set `CoachAiSettings__Provider`, `CoachAiSettings__ApiKey` (+ `Model`) as server env (Railway). Never client.
3. Implement the real call in `VendorCoachAiProvider.AnalyzeAsync` (or a vendor-named provider) + unit/integration
   tests; keep the disclaimer + structured shape.
4. Decide per-analysis cost ceiling; wire the `AiCost` audit hook to real accounting/alerts.
5. After real traffic, set `FraudSettings:EnforceBlocking=true` with tuned thresholds.
6. Flip client `COACH_CONFIG.provider="server"`; then flip the `coach` (and `paywall`, if charging) flags.

## What is intentionally NOT done (and why)
- **No vendor SDK / HTTP call, no key.** Owner-gated (account + credentials + budget). The stub throws.
- **No fabricated AI.** Mock output is clearly educational/demo; the vendor stub refuses to produce a result.
- **Flags stay OFF.** `coach` (and `paywall`) remain OFF until the vendor adapter + budget + (for charging)
  billing + legal are in place.
