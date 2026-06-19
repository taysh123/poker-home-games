using PokerApp.Domain.Enums;

namespace PokerApp.Application.Common.Interfaces;

/// <summary>A subscription state validated with the store (never trusted from the client).</summary>
public sealed record VerifiedSubscription(
    SubscriptionStore Store,
    string ProductId,
    string OriginalTransactionId,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    bool AutoRenew,
    bool IsSandbox,
    SubscriptionStatus Status);

/// <summary>
/// Vendor-agnostic receipt verifier (Apple/Google/RevenueCat behind this seam). B2 ships a mock;
/// a real verifier validates with the store. Returns null when the receipt is invalid (fail-closed).
/// </summary>
public interface IBillingVerifier
{
    Task<VerifiedSubscription?> VerifyAsync(SubscriptionStore store, string token, CancellationToken ct = default);
}
