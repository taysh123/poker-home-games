using PokerApp.Domain.Enums;

namespace PokerApp.Domain.Entities;

/// <summary>
/// Server-authoritative subscription, derived from validated store receipts / notifications.
/// The current entitlement is computed from the newest valid Subscription — never from the client.
/// </summary>
public class Subscription : BaseEntity
{
    public Guid UserId { get; private set; }
    public SubscriptionStore Store { get; private set; }
    public string ProductId { get; private set; } = string.Empty;
    public string Plan { get; private set; } = "premium";
    /// <summary>Stable store transaction id (Apple originalTransactionId / Google purchaseToken).</summary>
    public string OriginalTransactionId { get; private set; } = string.Empty;
    public SubscriptionStatus Status { get; private set; } = SubscriptionStatus.Active;
    public DateTime CurrentPeriodStart { get; private set; }
    public DateTime CurrentPeriodEnd { get; private set; }
    public bool AutoRenew { get; private set; }
    public bool IsSandbox { get; private set; }
    /// <summary>Timestamp of the latest applied store event — used to ignore out-of-order webhooks.</summary>
    public DateTime LatestEventAtUtc { get; private set; }

    private Subscription() { }

    public static Subscription Create(
        Guid userId, SubscriptionStore store, string productId, string originalTransactionId,
        DateTime periodStart, DateTime periodEnd, bool autoRenew, bool isSandbox, DateTime eventAtUtc) =>
        new()
        {
            UserId = userId, Store = store, ProductId = productId, OriginalTransactionId = originalTransactionId,
            Status = SubscriptionStatus.Active, CurrentPeriodStart = periodStart, CurrentPeriodEnd = periodEnd,
            AutoRenew = autoRenew, IsSandbox = isSandbox, LatestEventAtUtc = eventAtUtc,
        };

    /// <summary>Apply a (re)validation/renewal. Only applies if the event is newer than the last one.</summary>
    public bool Sync(string productId, DateTime periodStart, DateTime periodEnd, bool autoRenew,
        bool isSandbox, SubscriptionStatus status, DateTime eventAtUtc)
    {
        if (eventAtUtc < LatestEventAtUtc) return false; // out-of-order — ignore
        ProductId = productId;
        CurrentPeriodStart = periodStart;
        CurrentPeriodEnd = periodEnd;
        AutoRenew = autoRenew;
        IsSandbox = isSandbox;
        Status = status;
        LatestEventAtUtc = eventAtUtc;
        SetUpdatedAt();
        return true;
    }

    public void MarkRefunded(DateTime eventAtUtc) { Apply(SubscriptionStatus.Refunded, eventAtUtc); AutoRenew = false; }
    public void MarkCanceled(DateTime eventAtUtc) { Apply(SubscriptionStatus.Canceled, eventAtUtc); AutoRenew = false; }
    public void MarkExpired(DateTime eventAtUtc) => Apply(SubscriptionStatus.Expired, eventAtUtc);
    public void MarkGrace(DateTime eventAtUtc) => Apply(SubscriptionStatus.Grace, eventAtUtc);

    private void Apply(SubscriptionStatus status, DateTime eventAtUtc)
    {
        if (eventAtUtc < LatestEventAtUtc) return;
        Status = status;
        LatestEventAtUtc = eventAtUtc;
        SetUpdatedAt();
    }

    /// <summary>Premium access is live now (status allows it AND the period has not ended).</summary>
    public bool IsPremiumActive(DateTime now) =>
        (Status is SubscriptionStatus.Active or SubscriptionStatus.Grace or SubscriptionStatus.Canceled)
        && now <= CurrentPeriodEnd;
}
