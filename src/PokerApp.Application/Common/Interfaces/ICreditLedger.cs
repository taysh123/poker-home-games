namespace PokerApp.Application.Common.Interfaces;

public enum CreditDenyReason { None, NoCredits, RateLimited }

public sealed record CreditDecision(bool Allowed, int Remaining, CreditDenyReason Reason);

/// <summary>
/// Server-authoritative AI credit ledger. Atomic, idempotent, fail-closed. The materialized
/// balance is the spend target; the append-only ledger is the audit/reconstruction source.
/// </summary>
public interface ICreditLedger
{
    Task<int> GetRemainingAsync(Guid userId, AiCreditPolicy policy, DateTime nowUtc, CancellationToken ct = default);

    /// <summary>
    /// Atomically consume one credit for the current period (lazy-granting the period quota first).
    /// Idempotent on <paramref name="idempotencyKey"/> — a retried request never double-charges.
    /// </summary>
    Task<CreditDecision> TryConsumeAsync(Guid userId, AiCreditPolicy policy, string idempotencyKey, DateTime nowUtc, CancellationToken ct = default);

    /// <summary>Compensating refund for a prior consume (e.g. the AI provider failed after the decrement).</summary>
    Task RefundAsync(Guid userId, string consumeIdempotencyKey, DateTime nowUtc, CancellationToken ct = default);

    /// <summary>Add top-up credits to the current period (future consumable bundles).</summary>
    Task GrantTopUpAsync(Guid userId, AiCreditPolicy policy, int amount, string idempotencyKey, DateTime nowUtc, CancellationToken ct = default);
}
