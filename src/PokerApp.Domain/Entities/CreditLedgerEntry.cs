using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

/// <summary>
/// Append-only AI credit ledger entry — the auditable record of every grant/consume/refund.
/// The materialized <see cref="CreditBalance"/> is the fast read; this is the source of truth.
/// </summary>
public class CreditLedgerEntry : BaseEntity
{
    public Guid UserId { get; private set; }
    public CreditEntryType Type { get; private set; }
    public int Delta { get; private set; }
    /// <summary>Scopes the entry: "lifetime" (free) or "premium:yyyy-MM" (monthly), plus future tiers.</summary>
    public string PeriodKey { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;
    /// <summary>Idempotency key (unique) — dedupes retried consumes so credits are never double-charged.</summary>
    public string IdempotencyKey { get; private set; } = string.Empty;
    public string? SourceRef { get; private set; }

    private CreditLedgerEntry() { }

    public static CreditLedgerEntry Create(
        Guid userId, CreditEntryType type, int delta, string periodKey,
        string reason, string idempotencyKey, string? sourceRef = null) =>
        new()
        {
            UserId = userId, Type = type, Delta = delta, PeriodKey = periodKey,
            Reason = reason, IdempotencyKey = idempotencyKey, SourceRef = sourceRef,
        };
}
