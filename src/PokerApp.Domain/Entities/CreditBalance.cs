namespace PokerApp.Domain.Entities;

/// <summary>
/// Materialized AI credit balance for a (user, period). The atomic-decrement target; always
/// reconcilable from the ledger. Concurrency is protected at the DB level (Postgres xmin).
/// </summary>
public class CreditBalance : BaseEntity
{
    public Guid UserId { get; private set; }
    /// <summary>"lifetime" (free) or "premium:yyyy-MM" (monthly), etc.</summary>
    public string PeriodKey { get; private set; } = string.Empty;
    public int Granted { get; private set; }
    public int Consumed { get; private set; }
    public DateTime? LastConsumedAtUtc { get; private set; }

    public int Remaining => Granted - Consumed;

    private CreditBalance() { }

    public static CreditBalance Create(Guid userId, string periodKey, int granted) =>
        new() { UserId = userId, PeriodKey = periodKey, Granted = granted, Consumed = 0 };

    /// <summary>Consume one credit. Returns false if none remain (caller must check / fail closed).</summary>
    public bool TryConsume(DateTime nowUtc)
    {
        if (Remaining <= 0) return false;
        Consumed++;
        LastConsumedAtUtc = nowUtc;
        SetUpdatedAt();
        return true;
    }

    public void Refund()
    {
        if (Consumed > 0) Consumed--;
        SetUpdatedAt();
    }

    public void AddGrant(int amount)
    {
        if (amount <= 0) return;
        Granted += amount;
        SetUpdatedAt();
    }
}
